/**
 * Converts between OpenAI chat completion format and Anthropic Messages format.
 * Auto-injects cache_control breakpoints on system prompts and tool definitions
 * so Anthropic prompt caching works transparently through the proxy.
 */
import { randomUUID } from 'crypto';

interface OpenAIMessage {
  role: string;
  content?: unknown;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  [key: string]: unknown;
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  cache_control?: { type: string };
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema?: unknown;
  cache_control?: { type: string };
}

const CACHE = { type: 'ephemeral' } as const;

/* ── Request helpers ── */

function extractSystemBlocks(messages: OpenAIMessage[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const msg of messages) {
    if (msg.role !== 'system' && msg.role !== 'developer') continue;
    if (typeof msg.content === 'string') {
      blocks.push({ type: 'text', text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as Array<Record<string, unknown>>) {
        if (part.type === 'text' && typeof part.text === 'string') {
          blocks.push({ type: 'text', text: part.text });
        }
      }
    }
  }
  return blocks;
}

function toContentBlocks(content: unknown): ContentBlock[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (Array.isArray(content)) {
    return (content as Array<Record<string, unknown>>)
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => ({ type: 'text', text: b.text as string }));
  }
  return [];
}

function convertMessage(
  msg: OpenAIMessage,
): { role: 'user' | 'assistant'; content: ContentBlock[] } | null {
  if (msg.role === 'system' || msg.role === 'developer') return null;

  if (msg.role === 'tool') {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
    return {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: (msg.tool_call_id as string) || 'unknown',
          content: text,
        },
      ],
    };
  }

  if (msg.role === 'assistant') {
    const blocks: ContentBlock[] = [...toContentBlocks(msg.content)];
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}'),
        });
      }
    }
    return blocks.length > 0 ? { role: 'assistant', content: blocks } : null;
  }

  const blocks = toContentBlocks(msg.content);
  return blocks.length > 0 ? { role: 'user', content: blocks } : null;
}

function convertTools(tools?: Array<Record<string, unknown>>): AnthropicTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  const out: AnthropicTool[] = [];
  for (const t of tools) {
    const fn = t.function as
      | { name: string; description?: string; parameters?: unknown }
      | undefined;
    if (fn) out.push({ name: fn.name, description: fn.description, input_schema: fn.parameters });
  }
  return out.length > 0 ? out : undefined;
}

/* ── Request conversion ── */

export interface AnthropicRequestOptions {
  /** When false, cache_control fields are omitted from the request. Defaults to true. */
  injectCacheControl?: boolean;
}

export function toAnthropicRequest(
  body: Record<string, unknown>,
  _model: string,
  options?: AnthropicRequestOptions,
): Record<string, unknown> {
  const shouldCache = options?.injectCacheControl !== false;
  const messages = (body.messages as OpenAIMessage[]) || [];
  const systemBlocks = extractSystemBlocks(messages);
  if (systemBlocks.length > 0 && shouldCache) {
    systemBlocks[systemBlocks.length - 1].cache_control = CACHE;
  }

  const converted = messages.map(convertMessage).filter(Boolean);
  const result: Record<string, unknown> = {
    messages: converted,
    max_tokens: (body.max_tokens as number) || 4096,
  };
  if (shouldCache) result.cache_control = { type: 'ephemeral' };

  if (systemBlocks.length > 0) result.system = systemBlocks;

  const tools = convertTools(body.tools as Array<Record<string, unknown>> | undefined);
  if (tools) {
    if (shouldCache) tools[tools.length - 1].cache_control = CACHE;
    result.tools = tools;
  }

  if (body.temperature !== undefined) result.temperature = body.temperature;
  if (body.top_p !== undefined) result.top_p = body.top_p;
  return result;
}

/* ── Response conversion ── */

function mapStopReason(reason: string | undefined): string {
  if (!reason) return 'stop';
  const map: Record<string, string> = {
    end_turn: 'stop',
    max_tokens: 'length',
    tool_use: 'tool_calls',
    stop_sequence: 'stop',
  };
  return map[reason] ?? 'stop';
}

export function fromAnthropicResponse(
  resp: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const content = (resp.content as Array<Record<string, unknown>>) || [];
  let textContent = '';
  const toolCalls: Record<string, unknown>[] = [];

  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') textContent += block.text;
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id as string,
        type: 'function',
        function: { name: block.name as string, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }

  const message: Record<string, unknown> = { role: 'assistant', content: textContent || null };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  const usage = resp.usage as Record<string, number> | undefined;
  // Anthropic's input_tokens is only non-cached tokens. OpenAI convention:
  // prompt_tokens = total input (including cache), cached_tokens = subset from cache.
  const cacheRead = usage?.cache_read_input_tokens ?? 0;
  const cacheCreation = usage?.cache_creation_input_tokens ?? 0;
  const totalInput = (usage?.input_tokens ?? 0) + cacheRead + cacheCreation;
  const totalOutput = usage?.output_tokens ?? 0;
  return {
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      { index: 0, message, finish_reason: mapStopReason(resp.stop_reason as string | undefined) },
    ],
    usage: usage
      ? {
          prompt_tokens: totalInput,
          completion_tokens: totalOutput,
          total_tokens: totalInput + totalOutput,
          prompt_tokens_details: { cached_tokens: cacheRead },
          cache_read_tokens: cacheRead,
          cache_creation_tokens: cacheCreation,
        }
      : undefined,
  };
}

/* ── Stream chunk conversion ── */

function makeChunkSse(
  model: string,
  delta: Record<string, unknown>,
  finishReason: string | null,
): string {
  return `data: ${JSON.stringify({
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

function parseStreamEvent(
  chunk: string,
): { eventType: string; data: Record<string, unknown> } | null {
  if (!chunk.trim()) return null;

  const lines = chunk.split('\n');
  let eventType = '';
  let jsonPayload = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('event:')) eventType = trimmed.slice(6).trim();
    else if (trimmed) jsonPayload = trimmed;
  }

  if (!jsonPayload) return null;
  try {
    return { eventType, data: JSON.parse(jsonPayload) };
  } catch {
    return null;
  }
}

function makeUsageSse(model: string, usage: Record<string, unknown>): string {
  return `data: ${JSON.stringify({
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [],
    usage,
  })}\n\n`;
}

/**
 * Creates a stateful stream transformer that accumulates usage across events.
 * Returns a transform function compatible with pipeStream.
 */
export function createAnthropicStreamTransformer(model: string): (chunk: string) => string | null {
  let inputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  const toolCallByContentIndex = new Map<
    number,
    { id: string; name: string; openaiIndex: number }
  >();

  return (chunk: string): string | null => {
    const parsed = parseStreamEvent(chunk);
    if (!parsed) return null;
    const { eventType, data } = parsed;

    if (eventType === 'message_start' || data.type === 'message_start') {
      toolCallByContentIndex.clear();
      const msg = data.message as Record<string, unknown> | undefined;
      const usage = msg?.usage as Record<string, number> | undefined;
      inputTokens = usage?.input_tokens ?? 0;
      cacheReadTokens = usage?.cache_read_input_tokens ?? 0;
      cacheCreationTokens = usage?.cache_creation_input_tokens ?? 0;
      return makeChunkSse(model, { role: 'assistant', content: '' }, null);
    }

    if (eventType === 'content_block_start' || data.type === 'content_block_start') {
      const block = data.content_block as Record<string, unknown> | undefined;
      const contentIndex = data.index as number | undefined;
      if (
        block?.type === 'tool_use' &&
        typeof block.id === 'string' &&
        typeof block.name === 'string' &&
        typeof contentIndex === 'number'
      ) {
        const openaiIndex = toolCallByContentIndex.size;
        toolCallByContentIndex.set(contentIndex, {
          id: block.id,
          name: block.name,
          openaiIndex,
        });
        return makeChunkSse(
          model,
          {
            tool_calls: [
              {
                index: openaiIndex,
                id: block.id,
                type: 'function',
                function: { name: block.name, arguments: '' },
              },
            ],
          },
          null,
        );
      }
      return null;
    }

    if (eventType === 'content_block_delta' || data.type === 'content_block_delta') {
      const delta = data.delta as Record<string, unknown> | undefined;
      if (!delta) return null;
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        return makeChunkSse(model, { content: delta.text }, null);
      }
      if (delta.type === 'input_json_delta') {
        const contentIndex = data.index as number | undefined;
        const meta =
          typeof contentIndex === 'number' ? toolCallByContentIndex.get(contentIndex) : undefined;
        if (!meta) return null;
        const partialJson = typeof delta.partial_json === 'string' ? delta.partial_json : '';
        return makeChunkSse(
          model,
          {
            tool_calls: [{ index: meta.openaiIndex, function: { arguments: partialJson } }],
          },
          null,
        );
      }
      return null;
    }

    if (eventType === 'message_delta' || data.type === 'message_delta') {
      const delta = data.delta as Record<string, unknown> | undefined;
      const usage = data.usage as Record<string, number> | undefined;
      const outputTokens = usage?.output_tokens ?? 0;
      // Anthropic's inputTokens is non-cached only; total = non-cached + cache reads + cache creation
      const totalInput = inputTokens + cacheReadTokens + cacheCreationTokens;
      const total = totalInput + outputTokens;

      const finishChunk = makeChunkSse(
        model,
        {},
        mapStopReason(delta?.stop_reason as string | undefined),
      );
      const usageChunk = makeUsageSse(model, {
        prompt_tokens: totalInput,
        completion_tokens: outputTokens,
        total_tokens: total,
        prompt_tokens_details: { cached_tokens: cacheReadTokens },
        cache_read_tokens: cacheReadTokens,
        cache_creation_tokens: cacheCreationTokens,
      });
      return finishChunk + usageChunk;
    }

    return null;
  };
}

/** Stateless convenience for single-chunk tests. */
export function transformAnthropicStreamChunk(chunk: string, model: string): string | null {
  return createAnthropicStreamTransformer(model)(chunk);
}
