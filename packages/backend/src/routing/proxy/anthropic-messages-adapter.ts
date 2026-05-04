/**
 * Translates between the public Anthropic Messages API format
 * (POST /v1/messages) and the internal chat-completions request/response
 * format used by Manifest's routing pipeline. Mirrors `responses-adapter.ts`
 * for the OpenAI Responses API.
 */
import { randomUUID } from 'crypto';

import { OpenAIMessage } from './proxy-types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value ?? '');
  } catch {
    return '';
  }
}

function systemToString(system: unknown): string {
  if (typeof system === 'string') return system;
  if (!Array.isArray(system)) return '';
  return system
    .filter(isRecord)
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n\n');
}

function anthropicContentToChat(content: unknown): {
  text: string;
  parts: JsonRecord[];
  toolUses: Array<{ id: string; name: string; input: unknown }>;
  toolResults: Array<{ toolUseId: string; content: string }>;
} {
  const out = {
    text: '',
    parts: [] as JsonRecord[],
    toolUses: [] as Array<{ id: string; name: string; input: unknown }>,
    toolResults: [] as Array<{ toolUseId: string; content: string }>,
  };

  if (typeof content === 'string') {
    out.text = content;
    if (content) out.parts.push({ type: 'text', text: content });
    return out;
  }
  if (!Array.isArray(content)) return out;

  for (const block of content) {
    if (!isRecord(block)) continue;
    if (block.type === 'text' && typeof block.text === 'string') {
      out.text += block.text;
      out.parts.push({ type: 'text', text: block.text });
    } else if (block.type === 'image' && isRecord(block.source)) {
      const source = block.source;
      if (source.type === 'base64' && typeof source.data === 'string') {
        const mediaType = typeof source.media_type === 'string' ? source.media_type : 'image/png';
        out.parts.push({
          type: 'image_url',
          image_url: { url: `data:${mediaType};base64,${source.data}` },
        });
      } else if (source.type === 'url' && typeof source.url === 'string') {
        out.parts.push({ type: 'image_url', image_url: { url: source.url } });
      }
    } else if (block.type === 'tool_use') {
      out.toolUses.push({
        id: typeof block.id === 'string' ? block.id : randomUUID(),
        name: typeof block.name === 'string' ? block.name : 'unknown',
        input: block.input ?? {},
      });
    } else if (block.type === 'tool_result') {
      out.toolResults.push({
        toolUseId: typeof block.tool_use_id === 'string' ? block.tool_use_id : 'unknown',
        content: safeJsonStringify(block.content),
      });
    }
  }

  return out;
}

function buildUserOrAssistantMessage(
  role: 'user' | 'assistant',
  content: unknown,
): OpenAIMessage[] {
  const { text, parts, toolUses, toolResults } = anthropicContentToChat(content);
  const messages: OpenAIMessage[] = [];

  // tool_result blocks become standalone tool-role messages in chat_completions.
  for (const result of toolResults) {
    messages.push({ role: 'tool', tool_call_id: result.toolUseId, content: result.content });
  }

  if (role === 'assistant') {
    const tool_calls = toolUses.map((tu) => ({
      id: tu.id,
      type: 'function',
      function: { name: tu.name, arguments: safeJsonStringify(tu.input) },
    }));
    if (text || tool_calls.length > 0) {
      const message: OpenAIMessage = { role: 'assistant', content: text || null };
      if (tool_calls.length > 0) message.tool_calls = tool_calls;
      messages.push(message);
    }
    return messages;
  }

  // user role
  const otherParts = parts.filter((p) => p.type !== 'text');
  const hasNonText = otherParts.length > 0;
  const hasText = parts.some((p) => p.type === 'text');
  if (hasText && !hasNonText) {
    if (text) messages.push({ role: 'user', content: text });
  } else if (hasNonText) {
    messages.push({ role: 'user', content: parts });
  }
  return messages;
}

function toChatTools(tools: unknown[]): JsonRecord[] {
  return tools.filter(isRecord).map((tool) => ({
    type: 'function',
    function: {
      name: typeof tool.name === 'string' ? tool.name : 'unknown',
      ...(typeof tool.description === 'string' && { description: tool.description }),
      ...(tool.input_schema !== undefined && { parameters: tool.input_schema }),
    },
  }));
}

function toChatToolChoice(choice: unknown): unknown {
  if (!isRecord(choice)) return undefined;
  if (choice.type === 'auto') return 'auto';
  if (choice.type === 'any') return 'required';
  if (choice.type === 'tool' && typeof choice.name === 'string') {
    return { type: 'function', function: { name: choice.name } };
  }
  return undefined;
}

/** Anthropic Messages request → chat_completions request (used for routing/forwarding). */
export function messagesToChatCompletionsRequest(body: JsonRecord): JsonRecord {
  const messages: OpenAIMessage[] = [];

  const systemText = systemToString(body.system);
  if (systemText) messages.push({ role: 'system', content: systemText });

  const inputMessages = Array.isArray(body.messages) ? body.messages : [];
  for (const item of inputMessages) {
    if (!isRecord(item)) continue;
    const role = item.role === 'assistant' ? 'assistant' : 'user';
    messages.push(...buildUserOrAssistantMessage(role, item.content));
  }

  const chatBody: JsonRecord = { messages };

  if (typeof body.model === 'string') chatBody.model = body.model;
  if (body.max_tokens !== undefined) chatBody.max_tokens = body.max_tokens;
  if (body.temperature !== undefined) chatBody.temperature = body.temperature;
  if (body.top_p !== undefined) chatBody.top_p = body.top_p;
  if (body.stream !== undefined) chatBody.stream = body.stream;
  if (body.metadata !== undefined) chatBody.metadata = body.metadata;
  if (body.stop_sequences !== undefined) chatBody.stop = body.stop_sequences;
  // Anthropic-native fields with no chat_completions analogue. Carried on
  // chatBody so toAnthropicRequest can forward them when the resolved
  // provider is Anthropic; harmlessly ignored by other adapters.
  if (body.thinking !== undefined) chatBody.thinking = body.thinking;
  if (body.top_k !== undefined) chatBody.top_k = body.top_k;

  if (Array.isArray(body.tools)) chatBody.tools = toChatTools(body.tools);
  const toolChoice = toChatToolChoice(body.tool_choice);
  if (toolChoice !== undefined) chatBody.tool_choice = toolChoice;

  return chatBody;
}

const STOP_REASON_MAP: Record<string, string> = {
  stop: 'end_turn',
  length: 'max_tokens',
  tool_calls: 'tool_use',
};

function toAnthropicStopReason(finishReason: unknown): string {
  if (typeof finishReason !== 'string') return 'end_turn';
  return STOP_REASON_MAP[finishReason] ?? 'end_turn';
}

function toAnthropicUsage(usage: unknown): JsonRecord {
  const u = isRecord(usage) ? usage : {};
  const inputTokens = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0;
  const outputTokens = typeof u.completion_tokens === 'number' ? u.completion_tokens : 0;
  const cacheRead = typeof u.cache_read_tokens === 'number' ? u.cache_read_tokens : 0;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: cacheRead,
  };
}

function safeParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/** chat_completions response → Anthropic Messages response. */
export function chatCompletionsResponseToMessages(body: JsonRecord, model: string): JsonRecord {
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const firstChoice = isRecord(choices[0]) ? choices[0] : {};
  const message = isRecord(firstChoice.message) ? firstChoice.message : {};

  const content: JsonRecord[] = [];
  const text =
    typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content)
        ? (message.content as Array<JsonRecord>)
            .filter(isRecord)
            .map((p) => (typeof p.text === 'string' ? p.text : ''))
            .join('')
        : '';
  if (text) content.push({ type: 'text', text });

  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      if (!isRecord(call) || !isRecord(call.function)) continue;
      content.push({
        type: 'tool_use',
        id: typeof call.id === 'string' ? call.id : `toolu_${randomUUID().replace(/-/g, '')}`,
        name: typeof call.function.name === 'string' ? call.function.name : '',
        input: safeParseJson(call.function.arguments),
      });
    }
  }

  const stopReason = toAnthropicStopReason(firstChoice.finish_reason);

  return {
    id: typeof body.id === 'string' ? body.id : `msg_${randomUUID().replace(/-/g, '')}`,
    type: 'message',
    role: 'assistant',
    model: typeof body.model === 'string' ? body.model : model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: toAnthropicUsage(body.usage),
  };
}

interface StreamState {
  messageId: string;
  model: string;
  startedMessage: boolean;
  textIndex: number | null;
  textOpened: boolean;
  toolCalls: Map<number, { id: string; index: number; argBuffer: string; opened: boolean }>;
  finalUsage: JsonRecord | null;
  stopReason: string | null;
  endedMessage: boolean;
}

export interface MessagesStreamTransformer {
  transform: (chunk: string) => string | null;
  finalize: () => string | null;
}

export function createMessagesStreamTransformer(model: string): MessagesStreamTransformer {
  const state: StreamState = {
    messageId: `msg_${randomUUID().replace(/-/g, '')}`,
    model,
    startedMessage: false,
    textIndex: null,
    textOpened: false,
    toolCalls: new Map(),
    finalUsage: null,
    stopReason: null,
    endedMessage: false,
  };

  return {
    transform: (chunk: string) => transformStreamChunk(chunk, state),
    finalize: () => {
      const events = closeStream(state);
      return events.length > 0 ? events.join('') : null;
    },
  };
}

function transformStreamChunk(chunk: string, state: StreamState): string | null {
  const events: string[] = [];
  for (const payload of extractDataPayloads(chunk)) {
    if (payload === '[DONE]') continue;
    const data = safeParse(payload);
    if (!data) continue;

    if (!state.startedMessage) {
      events.push(buildMessageStartEvent(state, data));
      state.startedMessage = true;
    }

    const choices = Array.isArray(data.choices) ? data.choices : [];
    if (choices.length === 0 && isRecord(data.usage)) {
      state.finalUsage = toAnthropicUsage(data.usage);
      continue;
    }

    const choice = isRecord(choices[0]) ? choices[0] : null;
    if (!choice) continue;
    const delta = isRecord(choice.delta) ? choice.delta : {};

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      if (state.textIndex === null) {
        state.textIndex = nextBlockIndex(state);
        events.push(
          formatMessagesEvent('content_block_start', {
            type: 'content_block_start',
            index: state.textIndex,
            content_block: { type: 'text', text: '' },
          }),
        );
        state.textOpened = true;
      }
      events.push(
        formatMessagesEvent('content_block_delta', {
          type: 'content_block_delta',
          index: state.textIndex,
          delta: { type: 'text_delta', text: delta.content },
        }),
      );
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const call of delta.tool_calls) {
        if (!isRecord(call)) continue;
        const callIndex = typeof call.index === 'number' ? call.index : 0;
        let entry = state.toolCalls.get(callIndex);
        if (!entry) {
          entry = {
            id: typeof call.id === 'string' ? call.id : `toolu_${randomUUID().replace(/-/g, '')}`,
            index: nextBlockIndex(state),
            argBuffer: '',
            opened: false,
          };
          state.toolCalls.set(callIndex, entry);
        }
        const fn = isRecord(call.function) ? call.function : {};
        if (!entry.opened) {
          events.push(
            formatMessagesEvent('content_block_start', {
              type: 'content_block_start',
              index: entry.index,
              content_block: {
                type: 'tool_use',
                id: entry.id,
                name: typeof fn.name === 'string' ? fn.name : '',
                input: {},
              },
            }),
          );
          entry.opened = true;
        }
        if (typeof fn.arguments === 'string' && fn.arguments.length > 0) {
          entry.argBuffer += fn.arguments;
          events.push(
            formatMessagesEvent('content_block_delta', {
              type: 'content_block_delta',
              index: entry.index,
              delta: { type: 'input_json_delta', partial_json: fn.arguments },
            }),
          );
        }
      }
    }

    if (choice.finish_reason) {
      state.stopReason = toAnthropicStopReason(choice.finish_reason);
      if (isRecord(data.usage) && !state.finalUsage) {
        state.finalUsage = toAnthropicUsage(data.usage);
      }
    }
  }

  return events.length > 0 ? events.join('') : null;
}

function nextBlockIndex(state: StreamState): number {
  return (state.textIndex !== null ? 1 : 0) + state.toolCalls.size;
}

function buildMessageStartEvent(state: StreamState, data: JsonRecord): string {
  const usage = isRecord(data.usage) ? toAnthropicUsage(data.usage) : toAnthropicUsage({});
  return formatMessagesEvent('message_start', {
    type: 'message_start',
    message: {
      id: state.messageId,
      type: 'message',
      role: 'assistant',
      model: typeof data.model === 'string' ? data.model : state.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage,
    },
  });
}

function closeStream(state: StreamState): string[] {
  if (state.endedMessage) return [];
  const events: string[] = [];

  if (state.textOpened && state.textIndex !== null) {
    events.push(
      formatMessagesEvent('content_block_stop', {
        type: 'content_block_stop',
        index: state.textIndex,
      }),
    );
  }
  for (const entry of state.toolCalls.values()) {
    if (!entry.opened) continue;
    events.push(
      formatMessagesEvent('content_block_stop', {
        type: 'content_block_stop',
        index: entry.index,
      }),
    );
  }

  events.push(
    formatMessagesEvent('message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: state.stopReason ?? 'end_turn',
        stop_sequence: null,
      },
      usage: state.finalUsage ?? toAnthropicUsage({}),
    }),
  );
  events.push(formatMessagesEvent('message_stop', { type: 'message_stop' }));
  state.endedMessage = true;
  return events;
}

function extractDataPayloads(chunk: string): string[] {
  const lines = chunk.split('\n').map((line) => line.trim());
  const dataLines = lines.filter((line) => line.startsWith('data:'));
  if (dataLines.length > 0) return dataLines.map((line) => line.slice(5).trim());
  return [chunk.trim()].filter(Boolean);
}

function safeParse(data: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(data);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatMessagesEvent(event: string, data: JsonRecord): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
