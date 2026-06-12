/**
 * Converts between OpenAI chat completion format and Anthropic Messages format.
 * Auto-injects cache_control breakpoints on system prompts and tool definitions
 * so Anthropic prompt caching works transparently through the proxy.
 */
import { randomUUID } from 'crypto';

import { OpenAIMessage, ThinkingBlockLookup } from './proxy-types';
import type { ThinkingBlock } from './thinking-block-cache';

interface ContentBlock {
  type: string;
  text?: string;
  source?: { type: string; media_type?: string; data?: string; url?: string };
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  cache_control?: { type: string };
  // Extended-thinking fields. Only populated on `thinking` /
  // `redacted_thinking` blocks. We never inspect them beyond pass-through.
  thinking?: string;
  signature?: string;
  data?: string;
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema?: unknown;
  cache_control?: { type: string };
}

const CACHE = { type: 'ephemeral' } as const;
const ANTHROPIC_PREFIX = 'anthropic/';
const DATA_IMAGE_URL_RE = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/is;

function bareAnthropicModel(model: string): string {
  return model.startsWith(ANTHROPIC_PREFIX) ? model.slice(ANTHROPIC_PREFIX.length) : model;
}

function isClaudeHaikuModel(model: string): boolean {
  const bare = bareAnthropicModel(model).replace(/\./g, '-');
  return bare.startsWith('claude-haiku-');
}

function shouldForwardAnthropicThinking(thinking: unknown, model: string): boolean {
  if (
    thinking &&
    typeof thinking === 'object' &&
    !Array.isArray(thinking) &&
    (thinking as Record<string, unknown>).type === 'adaptive'
  ) {
    return !isClaudeHaikuModel(model);
  }
  return true;
}

/**
 * System prompt required by Anthropic's subscription OAuth API to unlock
 * sonnet/opus model families. Without it, subscription tokens can only
 * access haiku. This mirrors how the Copilot integration spoofs
 * Editor-Version headers to satisfy GitHub's API validation.
 */
const SUBSCRIPTION_IDENTITY_BLOCK: ContentBlock = {
  type: 'text',
  text: "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
  cache_control: { type: 'ephemeral' },
};

function safeParseArgs(args: string | undefined): unknown {
  try {
    return JSON.parse(args || '{}');
  } catch {
    return {};
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/* ── Request helpers ── */

function isTextContentPart(part: Record<string, unknown>): part is Record<string, unknown> & {
  text: string;
} {
  return (
    typeof part.text === 'string' &&
    (part.type === 'text' || part.type === 'input_text' || part.type === 'output_text')
  );
}

function extractSystemBlocks(messages: OpenAIMessage[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const msg of messages) {
    if (msg.role !== 'system' && msg.role !== 'developer') continue;
    if (typeof msg.content === 'string') {
      blocks.push({ type: 'text', text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as Array<Record<string, unknown>>) {
        if (isObjectRecord(part) && isTextContentPart(part)) {
          blocks.push({ type: 'text', text: part.text });
        }
      }
    }
  }
  return blocks;
}

function extractOpenAiImageUrl(imageUrl: unknown): string | null {
  if (typeof imageUrl === 'string') return imageUrl;
  if (!isObjectRecord(imageUrl) || typeof imageUrl.url !== 'string') return null;
  return imageUrl.url;
}

function imageUrlToAnthropicBlock(imageUrl: unknown): ContentBlock | null {
  const url = extractOpenAiImageUrl(imageUrl);
  if (!url) return null;

  const dataUrl = DATA_IMAGE_URL_RE.exec(url);
  if (dataUrl) {
    const mediaType = dataUrl[1] || 'image/png';
    if (!mediaType.toLowerCase().startsWith('image/')) return null;
    return {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: dataUrl[2] },
    };
  }

  return { type: 'image', source: { type: 'url', url } };
}

function normalizeAnthropicImageBlock(part: Record<string, unknown>): ContentBlock | null {
  if (part.type !== 'image' || !isObjectRecord(part.source)) return null;
  const source = part.source;
  if (source.type === 'base64' && typeof source.data === 'string') {
    const mediaType = typeof source.media_type === 'string' ? source.media_type : 'image/png';
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: source.data } };
  }
  if (source.type === 'url' && typeof source.url === 'string') {
    return { type: 'image', source: { type: 'url', url: source.url } };
  }
  return null;
}

function toContentBlocks(content: unknown, includeImages = false): ContentBlock[] {
  if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : [];
  if (Array.isArray(content)) {
    const blocks: ContentBlock[] = [];
    for (const part of content) {
      if (!isObjectRecord(part)) continue;
      if (isTextContentPart(part)) {
        blocks.push({ type: 'text', text: part.text });
      } else if (includeImages) {
        const imageBlock =
          part.type === 'image_url'
            ? imageUrlToAnthropicBlock(part.image_url)
            : part.type === 'input_image'
              ? imageUrlToAnthropicBlock(part.image_url)
              : normalizeAnthropicImageBlock(part);
        if (imageBlock) blocks.push(imageBlock);
      }
    }
    return blocks;
  }
  return [];
}

function convertMessage(
  msg: OpenAIMessage,
  thinkingLookup?: ThinkingBlockLookup,
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
    const blocks: ContentBlock[] = [];

    // Re-inject cached thinking blocks BEFORE any other content. Anthropic
    // requires `thinking` / `redacted_thinking` blocks to precede `tool_use`
    // blocks in the assistant turn when thinking is enabled with tool use.
    // Keyed by the first tool_call id in this turn — that's enough to
    // identify the turn within a session, and the client always echoes the
    // tool_call ids back unchanged.
    const firstToolCallId = Array.isArray(msg.tool_calls) && msg.tool_calls[0]?.id;
    if (thinkingLookup && typeof firstToolCallId === 'string' && firstToolCallId) {
      const cached = thinkingLookup(firstToolCallId);
      if (cached) {
        for (const block of cached) blocks.push(block as ContentBlock);
      }
    }

    blocks.push(...toContentBlocks(msg.content));
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: safeParseArgs(tc.function.arguments),
        });
      }
    }
    return blocks.length > 0 ? { role: 'assistant', content: blocks } : null;
  }

  const blocks = toContentBlocks(msg.content, true);
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
  /** When true, prepends the Claude Code agent system prompt required for subscription OAuth tokens. */
  injectSubscriptionIdentity?: boolean;
  /** Lookup for re-injecting cached extended-thinking blocks. */
  thinkingLookup?: ThinkingBlockLookup;
}

export function toAnthropicRequest(
  body: Record<string, unknown>,
  _model: string,
  options?: AnthropicRequestOptions,
): Record<string, unknown> {
  const messages = (body.messages as OpenAIMessage[]) || [];
  const systemBlocks = extractSystemBlocks(messages);
  if (systemBlocks.length > 0) {
    systemBlocks[systemBlocks.length - 1].cache_control = CACHE;
  }

  // Subscription OAuth tokens require the Claude Code agent identity as the
  // first system block to access sonnet/opus models (haiku works without it).
  if (options?.injectSubscriptionIdentity) {
    systemBlocks.unshift({ ...SUBSCRIPTION_IDENTITY_BLOCK });
  }

  const thinkingLookup = options?.thinkingLookup;
  const converted = messages.map((msg) => convertMessage(msg, thinkingLookup)).filter(Boolean);
  const result: Record<string, unknown> = {
    messages: converted,
    max_tokens: (body.max_tokens as number) || 4096,
  };
  if (systemBlocks.length > 0) result.system = systemBlocks;

  // This path runs only for chat_completions inbound requests resolving to an
  // Anthropic upstream. Anthropic Messages inbound requests (POST /v1/messages)
  // bypass translation entirely via applyAnthropicMessagesMutations, so
  // server tools never reach this code path and the OpenAI function-shape
  // assumption is safe.
  const tools = convertTools(body.tools as Array<Record<string, unknown>> | undefined);
  if (tools) {
    tools[tools.length - 1].cache_control = CACHE;
    result.tools = tools;
  }

  if (body.temperature !== undefined) result.temperature = body.temperature;
  if (body.top_p !== undefined) result.top_p = body.top_p;
  if (body.top_k !== undefined) result.top_k = body.top_k;
  // Anthropic-native fields forwarded when the inbound request originated as
  // Anthropic Messages (POST /v1/messages). Chat-completions clients won't
  // set these, so this is a no-op for the OpenAI-compat path.
  if (body.thinking !== undefined && shouldForwardAnthropicThinking(body.thinking, _model)) {
    result.thinking = body.thinking;
  }
  // chat_completions `stop` accepts string OR string[]; Anthropic
  // `stop_sequences` is always an array. Wrap a bare string so a single
  // stop sequence isn't silently dropped.
  if (Array.isArray(body.stop)) {
    result.stop_sequences = body.stop;
  } else if (typeof body.stop === 'string' && body.stop) {
    result.stop_sequences = [body.stop];
  }
  return result;
}

/**
 * Walk a native Anthropic Messages response body and pull out extended-thinking
 * blocks keyed by the first `tool_use` id, for the thinking-block cache. The
 * body itself is not mutated — used by the messages-passthrough response path
 * where we forward Anthropic content blocks unchanged (so `server_tool_use` /
 * `web_search_tool_result` and other Anthropic-only block types survive).
 */
export function extractThinkingBlocksFromMessagesResponse(
  body: Record<string, unknown>,
): ExtractedThinkingBlocks | undefined {
  const content = body.content;
  if (!Array.isArray(content)) return undefined;
  let firstToolUseId: string | null = null;
  const blocks: ThinkingBlock[] = [];
  for (const block of content as Array<Record<string, unknown>>) {
    if (block.type === 'thinking' || block.type === 'redacted_thinking') {
      blocks.push(block as ThinkingBlock);
    } else if (
      block.type === 'tool_use' &&
      firstToolUseId === null &&
      typeof block.id === 'string'
    ) {
      firstToolUseId = block.id;
    }
  }
  if (blocks.length === 0 || firstToolUseId === null) return undefined;
  return { firstToolUseId, blocks };
}

/**
 * Apply additive mutations to a body that is ALREADY in Anthropic Messages
 * shape (inbound `POST /v1/messages` forwarded to an Anthropic upstream).
 * Bypasses the lossy OpenAI round-trip used by `toAnthropicRequest`: server
 * tools keep their `type` discriminator, `cache_control` placement matches
 * what Anthropic would see natively, and Anthropic-only fields don't leak
 * through a chat-completions stencil. Mutations:
 *
 * - Default `max_tokens` to 4096 if unset.
 * - Inject the subscription-identity system block for OAuth tokens.
 * - Place a `cache_control` breakpoint on the last system block and last tool.
 * - Replay cached extended-thinking blocks at the head of assistant turns
 *   whose first content block is a `tool_use`.
 */
export function applyAnthropicMessagesMutations(
  body: Record<string, unknown>,
  options?: AnthropicRequestOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...body };

  // Normalize `system` to a content-block array so cache_control + identity
  // injection have a uniform target. Anthropic accepts either a bare string
  // or an array of blocks; we always emit the array form when either
  // mutation needs to happen, otherwise we leave a string system intact.
  const needsBlockSystem =
    options?.injectSubscriptionIdentity ||
    (typeof body.system === 'string' ? body.system : Array.isArray(body.system));
  if (needsBlockSystem) {
    let systemBlocks: ContentBlock[] = [];
    if (typeof body.system === 'string') {
      if (body.system) systemBlocks.push({ type: 'text', text: body.system });
    } else if (Array.isArray(body.system)) {
      systemBlocks = (body.system as ContentBlock[]).map((b) => ({ ...b }));
    }
    if (systemBlocks.length > 0) {
      systemBlocks[systemBlocks.length - 1].cache_control = CACHE;
    }
    if (options?.injectSubscriptionIdentity) {
      systemBlocks.unshift({ ...SUBSCRIPTION_IDENTITY_BLOCK });
    }
    if (systemBlocks.length > 0) {
      result.system = systemBlocks;
    } else {
      delete result.system;
    }
  }

  // Tools: shallow-clone the array + last entry so the cache_control mutation
  // doesn't bleed back into the inbound body. Server tools' `type` tag and
  // custom tools' `input_schema` both survive unchanged.
  if (Array.isArray(body.tools)) {
    const tools = (body.tools as Array<Record<string, unknown>>).map((t) => ({ ...t }));
    if (tools.length > 0) {
      tools[tools.length - 1].cache_control = CACHE;
    }
    result.tools = tools;
  }

  if (result.max_tokens === undefined) result.max_tokens = 4096;

  const thinkingLookup = options?.thinkingLookup;
  if (thinkingLookup && Array.isArray(body.messages)) {
    result.messages = (body.messages as Array<Record<string, unknown>>).map((m) => {
      if (m.role !== 'assistant' || !Array.isArray(m.content)) return m;
      const content = m.content as ContentBlock[];
      const firstToolUse = content.find((b) => b.type === 'tool_use');
      if (!firstToolUse || typeof firstToolUse.id !== 'string') return m;
      // Native Messages clients may already echo the previous assistant's
      // signed thinking blocks before the tool_use block. Prepending the
      // cached copy in that case would duplicate signed blocks and the
      // upstream would reject the conversation. Only replay when the turn
      // is missing the thinking prelude.
      const alreadyHasThinking = content.some(
        (b) => b.type === 'thinking' || b.type === 'redacted_thinking',
      );
      if (alreadyHasThinking) return m;
      const cached = thinkingLookup(firstToolUse.id);
      if (!cached || cached.length === 0) return m;
      return { ...m, content: [...(cached as ContentBlock[]), ...content] };
    });
  }

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

/**
 * Extended-thinking blocks collected from an Anthropic response, keyed by the
 * first tool_use id so the cache can look them up on the next turn.
 */
export interface ExtractedThinkingBlocks {
  firstToolUseId: string;
  blocks: ThinkingBlock[];
}

export function fromAnthropicResponse(
  resp: Record<string, unknown>,
  model: string,
): Record<string, unknown> & { _extractedThinkingBlocks?: ExtractedThinkingBlocks } {
  const content = (resp.content as Array<Record<string, unknown>>) || [];
  let textContent = '';
  const toolCalls: Record<string, unknown>[] = [];
  const thinkingBlocks: ThinkingBlock[] = [];

  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') textContent += block.text;
    if (block.type === 'thinking' || block.type === 'redacted_thinking') {
      // Pass blocks through unmodified — Anthropic signs them and the
      // signature becomes invalid if any field is altered or dropped.
      thinkingBlocks.push(block as ThinkingBlock);
    }
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

  // Only surface thinking blocks when there's at least one tool_use — thinking
  // blocks only need round-tripping in multi-turn tool-use conversations.
  const firstToolUseId = toolCalls[0]?.id;
  const extracted: ExtractedThinkingBlocks | undefined =
    thinkingBlocks.length > 0 && typeof firstToolUseId === 'string'
      ? { firstToolUseId, blocks: thinkingBlocks }
      : undefined;

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
    ...(extracted ? { _extractedThinkingBlocks: extracted } : {}),
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
 * Callback fired once per assistant turn when the stream transformer has
 * assembled a complete thinking-block sequence. The response handler caches
 * the blocks keyed by the first tool_use id for re-injection on the next turn.
 */
export type ThinkingBlocksCallback = (firstToolUseId: string, blocks: ThinkingBlock[]) => void;

/**
 * Mutable state threaded through the Anthropic stream transformer's per-event
 * handlers. Kept in its own type so the closure body stays short.
 */
interface StreamState {
  model: string;
  inputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  toolCallIndex: number;
  blockToToolIndex: Map<number, number>;
  thinkingBlocksByIndex: Map<number, ThinkingBlock>;
  firstToolUseId: string | null;
  onThinkingBlocks?: ThinkingBlocksCallback;
}

function handleMessageStart(state: StreamState, data: Record<string, unknown>): string {
  const msg = data.message as Record<string, unknown> | undefined;
  const usage = msg?.usage as Record<string, number> | undefined;
  state.inputTokens = usage?.input_tokens ?? 0;
  state.cacheReadTokens = usage?.cache_read_input_tokens ?? 0;
  state.cacheCreationTokens = usage?.cache_creation_input_tokens ?? 0;
  return makeChunkSse(state.model, { role: 'assistant', content: '' }, null);
}

function applyMessageDeltaUsage(
  state: StreamState,
  usage: Record<string, unknown> | undefined,
): void {
  if (!usage) return;
  if (typeof usage.input_tokens === 'number') state.inputTokens = usage.input_tokens;
  if (typeof usage.cache_read_input_tokens === 'number') {
    state.cacheReadTokens = usage.cache_read_input_tokens;
  }
  if (typeof usage.cache_creation_input_tokens === 'number') {
    state.cacheCreationTokens = usage.cache_creation_input_tokens;
  }
}

function handleContentBlockStart(state: StreamState, data: Record<string, unknown>): string | null {
  const block = data.content_block as Record<string, unknown> | undefined;
  const blockIndex = data.index as number;

  if (block?.type === 'thinking') {
    // Seed an empty thinking block; text + signature are filled in by deltas.
    state.thinkingBlocksByIndex.set(blockIndex, {
      type: 'thinking',
      thinking: '',
      signature: '',
    });
    return null;
  }
  if (block?.type === 'redacted_thinking') {
    // Arrives complete — no deltas follow.
    state.thinkingBlocksByIndex.set(blockIndex, { ...block } as ThinkingBlock);
    return null;
  }
  if (block?.type === 'tool_use') {
    const idx = state.toolCallIndex++;
    state.blockToToolIndex.set(blockIndex, idx);
    const toolUseId = block.id as string;
    if (state.firstToolUseId === null && typeof toolUseId === 'string') {
      state.firstToolUseId = toolUseId;
    }
    return makeChunkSse(
      state.model,
      {
        tool_calls: [
          {
            index: idx,
            id: toolUseId,
            type: 'function',
            function: { name: block.name as string, arguments: '' },
          },
        ],
      },
      null,
    );
  }
  return null;
}

function handleContentBlockDelta(state: StreamState, data: Record<string, unknown>): string | null {
  const delta = data.delta as Record<string, unknown> | undefined;
  if (!delta) return null;
  const blockIndex = data.index as number;

  if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
    const existing = state.thinkingBlocksByIndex.get(blockIndex);
    if (existing) {
      existing.thinking = ((existing.thinking as string) || '') + delta.thinking;
    }
    return null;
  }
  if (delta.type === 'signature_delta' && typeof delta.signature === 'string') {
    const existing = state.thinkingBlocksByIndex.get(blockIndex);
    if (existing) {
      existing.signature = ((existing.signature as string) || '') + delta.signature;
    }
    return null;
  }
  if (delta.type === 'text_delta' && typeof delta.text === 'string') {
    return makeChunkSse(state.model, { content: delta.text }, null);
  }
  if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
    const idx = state.blockToToolIndex.get(blockIndex);
    if (idx !== undefined) {
      return makeChunkSse(
        state.model,
        { tool_calls: [{ index: idx, function: { arguments: delta.partial_json as string } }] },
        null,
      );
    }
  }
  return null;
}

/**
 * Snapshot the assembled thinking blocks in index order and invoke the
 * callback. Deferred until message_delta so every thinking_delta /
 * signature_delta has been applied — emitting on the first tool_use was
 * racy if a block arrived interleaved. Deep-clones each block so later
 * mutations on the live map can't corrupt the cached copy.
 */
function flushThinkingBlocks(state: StreamState): void {
  if (!state.onThinkingBlocks || state.firstToolUseId === null) return;
  if (state.thinkingBlocksByIndex.size === 0) return;
  const blocks = Array.from(state.thinkingBlocksByIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, block]) => ({ ...block }));
  state.onThinkingBlocks(state.firstToolUseId, blocks);
}

function handleMessageDelta(state: StreamState, data: Record<string, unknown>): string {
  flushThinkingBlocks(state);
  const delta = data.delta as Record<string, unknown> | undefined;
  const usage = data.usage as Record<string, unknown> | undefined;
  applyMessageDeltaUsage(state, usage);
  const outputTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : 0;
  // inputTokens is non-cached only; total = non-cached + cache reads + cache creation
  const totalInput = state.inputTokens + state.cacheReadTokens + state.cacheCreationTokens;

  const finishChunk = makeChunkSse(
    state.model,
    {},
    mapStopReason(delta?.stop_reason as string | undefined),
  );
  const usageChunk = makeUsageSse(state.model, {
    prompt_tokens: totalInput,
    completion_tokens: outputTokens,
    total_tokens: totalInput + outputTokens,
    prompt_tokens_details: { cached_tokens: state.cacheReadTokens },
    cache_read_tokens: state.cacheReadTokens,
    cache_creation_tokens: state.cacheCreationTokens,
  });
  return finishChunk + usageChunk;
}

/**
 * Creates a stateful stream transformer that accumulates usage and thinking
 * blocks across events. Returns a transform function compatible with pipeStream.
 */
export function createAnthropicStreamTransformer(
  model: string,
  onThinkingBlocks?: ThinkingBlocksCallback,
): (chunk: string) => string | null {
  const state: StreamState = {
    model,
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    toolCallIndex: 0,
    blockToToolIndex: new Map(),
    thinkingBlocksByIndex: new Map(),
    firstToolUseId: null,
    onThinkingBlocks,
  };

  return (chunk: string): string | null => {
    const parsed = parseStreamEvent(chunk);
    if (!parsed) return null;
    const { eventType, data } = parsed;
    const type = eventType || (data.type as string | undefined);
    if (type === 'message_start') return handleMessageStart(state, data);
    if (type === 'content_block_start') return handleContentBlockStart(state, data);
    if (type === 'content_block_delta') return handleContentBlockDelta(state, data);
    if (type === 'message_delta') return handleMessageDelta(state, data);
    return null;
  };
}

/** Stateless convenience for single-chunk tests. */
export function transformAnthropicStreamChunk(chunk: string, model: string): string | null {
  return createAnthropicStreamTransformer(model)(chunk);
}
