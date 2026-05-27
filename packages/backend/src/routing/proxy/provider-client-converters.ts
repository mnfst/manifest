import {
  toGoogleRequest,
  fromGoogleResponse,
  transformGoogleStreamChunk,
  type GoogleStreamChunkResult,
} from './google-adapter';
import {
  applyAnthropicMessagesMutations,
  extractThinkingBlocksFromMessagesResponse,
  toAnthropicRequest,
  fromAnthropicResponse,
  transformAnthropicStreamChunk,
  createAnthropicStreamTransformer,
  type ThinkingBlocksCallback,
} from './anthropic-adapter';
import {
  toResponsesRequest,
  fromResponsesResponse,
  transformResponsesStreamChunk,
  collectChatGptSseResponse,
} from './chatgpt-adapter';

/** Convert a ChatGPT Responses API response to OpenAI format. */
export function convertChatGptResponse(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  return fromResponsesResponse(body, model);
}

/** Convert a ChatGPT Responses API SSE chunk to OpenAI format. */
export function convertChatGptStreamChunk(chunk: string, model: string): string | null {
  return transformResponsesStreamChunk(chunk, model);
}

/** Convert a Google non-streaming response to OpenAI format. */
export function convertGoogleResponse(
  googleBody: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  return fromGoogleResponse(googleBody, model);
}

/** Convert a Google SSE chunk to OpenAI SSE format. */
export function convertGoogleStreamChunk(chunk: string, model: string): GoogleStreamChunkResult {
  return transformGoogleStreamChunk(chunk, model);
}

/** Convert an Anthropic non-streaming response to OpenAI format. */
export function convertAnthropicResponse(
  anthropicBody: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  return fromAnthropicResponse(anthropicBody, model);
}

/** Convert an Anthropic SSE chunk to OpenAI SSE format. */
export function convertAnthropicStreamChunk(chunk: string, model: string): string | null {
  return transformAnthropicStreamChunk(chunk, model);
}

/** Create a stateful Anthropic stream transformer that tracks usage across events. */
export function createAnthropicTransformer(
  model: string,
  onThinkingBlocks?: ThinkingBlocksCallback,
): (chunk: string) => string | null {
  return createAnthropicStreamTransformer(model, onThinkingBlocks);
}

// Re-export adapter functions used by ProviderClient.forward()
export {
  applyAnthropicMessagesMutations,
  extractThinkingBlocksFromMessagesResponse,
  toGoogleRequest,
  toAnthropicRequest,
  toResponsesRequest,
  collectChatGptSseResponse,
};
export type { GoogleStreamChunkResult } from './google-adapter';
export type { ThinkingBlocksCallback } from './anthropic-adapter';
export type { SignatureLookup, ThinkingBlockLookup, ReasoningContentLookup } from './proxy-types';

// ─── OpenAI body sanitization (used by ProviderClient.forward) ───────────────

/**
 * OpenAI-only fields that other providers reject as "extra inputs not permitted".
 * Stripped before forwarding to non-OpenAI, non-OpenRouter providers.
 */
const OPENAI_ONLY_FIELDS = new Set([
  'store',
  'metadata',
  'service_tier',
  'stream_options',
  'modalities',
  'audio',
  'prediction',
  'reasoning_effort',
]);

/**
 * Providers that accept the full OpenAI top-level request schema without modification.
 * Nested message fields may still need target-aware cleanup.
 */
const PASSTHROUGH_PROVIDERS = new Set(['openai', 'openrouter']);
const STRICT_TOOL_SEQUENCE_ENDPOINTS = new Set(['openai']);
const MISTRAL_TOOL_CALL_ID_REGEX = /^[A-Za-z0-9]{9}$/;
const DEEPSEEK_MAX_TOKENS_LIMIT = 8192;

/**
 * OpenAI models that require `max_completion_tokens` instead of `max_tokens`.
 * All o-series reasoning models and GPT-5+ models use the new parameter.
 */
const OPENAI_MAX_COMPLETION_TOKENS_RE = /^(o\d|gpt-5)/i;

/**
 * Endpoints that ultimately hit OpenAI infrastructure and therefore need
 * `max_tokens` rewritten to `max_completion_tokens` for o-series / GPT-5+.
 * Copilot belongs here because GitHub Copilot proxies these models to OpenAI
 * (issue mnfst/manifest#1849).
 */
const OPENAI_MAX_COMPLETION_TOKENS_ENDPOINTS = new Set(['openai', 'copilot']);

function usesOpenAiMaxCompletionTokens(endpointKey: string, bareModel: string): boolean {
  return (
    OPENAI_MAX_COMPLETION_TOKENS_ENDPOINTS.has(endpointKey) &&
    OPENAI_MAX_COMPLETION_TOKENS_RE.test(bareModel)
  );
}

/**
 * Endpoints that tolerate `reasoning_content` for at least one model family.
 * Restricting model-family matching to this set prevents false positives on
 * strict OpenAI-compatible hosts that happen to serve a reasoning-derived
 * community slug and would reject the unknown message field.
 */
const REASONING_CONTENT_AWARE_ENDPOINTS = new Set(['openrouter', 'opencode-go', 'custom']);

const OPENCODE_GO_REASONING_MODEL_FAMILY_RE =
  /^(?:deepseek|kimi|glm|qwen|minimax|mimo)(?:[-_.\d]|$)/i;

/**
 * Some reasoning APIs reject follow-up turns that don't echo back the previous
 * assistant's `reasoning_content`. Preserve it for:
 *  - the native `deepseek` and `moonshot` endpoints (always)
 *  - OpenCode Go's known reasoning model families
 *  - aggregator/proxy endpoints whose `deepseek-*` slugs forward to a DeepSeek
 *    engine, or whose `moonshotai/*` slugs forward to Kimi
 *    (OpenRouter `deepseek/*` / `moonshotai/*` and DeepSeek custom providers).
 * Strict OpenAI-compatible endpoints (Mistral, native OpenAI, etc.) keep
 * stripping the field even if a community fine-tune slug contains "deepseek".
 */
export function supportsReasoningContent(endpointKey: string, model: string): boolean {
  const normalizedEndpoint = endpointKey.toLowerCase();
  const key = normalizedEndpoint.startsWith('custom:') ? 'custom' : normalizedEndpoint;
  if (key === 'deepseek') return true;
  if (key === 'moonshot') return true;
  if (!REASONING_CONTENT_AWARE_ENDPOINTS.has(key)) return false;
  // Bare model id after stripping any vendor/aggregator prefix:
  //   "deepseek/r1"             → "r1"            — OpenRouter, not deepseek-family
  //   "openrouter" + "deepseek/deepseek-r1" → "deepseek-r1" ✓
  //   "opencode-go/kimi-k2.6" → "kimi-k2.6" ✓
  //   "custom:<uuid>/deepseek-reasoner" → "deepseek-reasoner" ✓
  // (proxy-fallback.service strips "custom:<uuid>/" before forward, so in
  // practice the custom path passes the already-bare model — both shapes
  // are handled.)
  const bare = model.toLowerCase().split('/').pop() ?? '';
  if (key === 'opencode-go') {
    return OPENCODE_GO_REASONING_MODEL_FAMILY_RE.test(bare);
  }
  if (key === 'openrouter' && model.toLowerCase().startsWith('moonshotai/')) {
    return true;
  }
  return bare.includes('deepseek');
}

export type ReasoningContentCallback = (firstToolCallId: string, content: string) => void;

/**
 * Creates a stateful OpenAI-compatible stream transformer that passes chunks
 * through unchanged while accumulating reasoning_content for tool-call turns.
 */
export function createReasoningContentStreamTransformer(
  onReasoningContent?: ReasoningContentCallback,
): (chunk: string) => string | null {
  let accumulatedReasoning = '';
  let firstToolCallId: string | null = null;
  let storedReasoning = '';

  const storeIfReady = (): void => {
    if (
      onReasoningContent &&
      accumulatedReasoning &&
      firstToolCallId &&
      accumulatedReasoning !== storedReasoning
    ) {
      onReasoningContent(firstToolCallId, accumulatedReasoning);
      storedReasoning = accumulatedReasoning;
    }
  };

  return (chunk: string): string | null => {
    try {
      const parsed = JSON.parse(chunk) as Record<string, unknown>;
      const choice = (parsed.choices as Array<Record<string, unknown>> | undefined)?.[0];
      const delta = choice?.delta as Record<string, unknown> | undefined;

      if (delta) {
        if (typeof delta.reasoning_content === 'string') {
          accumulatedReasoning += delta.reasoning_content;
          storeIfReady();
        }
        const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(toolCalls)) {
          for (const toolCall of toolCalls) {
            if (!toolCall || typeof toolCall !== 'object' || Array.isArray(toolCall)) continue;
            if (firstToolCallId === null && typeof toolCall.id === 'string' && toolCall.id) {
              firstToolCallId = toolCall.id;
            }
          }
          storeIfReady();
        }
      }

      if (choice?.finish_reason === 'tool_calls') storeIfReady();
    } catch {
      // Pass malformed/non-JSON chunks through unchanged.
    }

    return `data: ${chunk}\n\n`;
  };
}

/**
 * `reasoning_details` is OpenRouter's structured echo of extended-thinking
 * blocks in assistant messages (array of `{type, thinking, signature}`).
 * Only OpenRouter accepts it as an input field — every other OpenAI-compatible
 * provider (Mistral, native OpenAI, Groq, etc.) rejects unknown message fields
 * with `extra_forbidden` / 422. Strip it before forwarding to those targets so
 * that turn N+1 doesn't fail when routing flips off a reasoning model.
 */
function supportsReasoningDetails(endpointKey: string): boolean {
  return endpointKey === 'openrouter';
}

function toolCallIds(toolCalls: unknown): string[] {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls
    .map((toolCall) => {
      if (!toolCall || typeof toolCall !== 'object' || Array.isArray(toolCall)) return null;
      const id = (toolCall as Record<string, unknown>).id;
      return typeof id === 'string' && id ? id : null;
    })
    .filter((id): id is string => id !== null);
}

function hasCompleteImmediateToolResponses(
  messages: unknown[],
  index: number,
  ids: string[],
): boolean {
  const pending = new Set(ids);
  for (let i = index + 1; i < messages.length; i++) {
    const message = messages[i];
    if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
    const record = message as Record<string, unknown>;
    if (record.role !== 'tool') return false;
    if (typeof record.tool_call_id !== 'string') return false;
    if (!pending.has(record.tool_call_id)) return false;
    pending.delete(record.tool_call_id);
    if (pending.size === 0) {
      const next = messages[i + 1];
      if (!next || typeof next !== 'object' || Array.isArray(next)) return true;
      return (next as Record<string, unknown>).role !== 'tool';
    }
  }
  return false;
}

function stripIncompleteToolCallBlocks(messages: unknown[], endpointKey: string): unknown[] {
  if (!STRICT_TOOL_SEQUENCE_ENDPOINTS.has(endpointKey)) return messages;

  const expectedToolCallIds = new Set<string>();
  const result: unknown[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      result.push(message);
      continue;
    }

    const record = message as Record<string, unknown>;
    if (record.role === 'tool' && typeof record.tool_call_id === 'string') {
      if (!expectedToolCallIds.has(record.tool_call_id)) continue;
      expectedToolCallIds.delete(record.tool_call_id);
      result.push(message);
      continue;
    }

    const hasToolCallsArray = Array.isArray(record.tool_calls) && record.tool_calls.length > 0;
    const ids = toolCallIds(record.tool_calls);
    if (record.role !== 'assistant' || !hasToolCallsArray) {
      result.push(message);
      continue;
    }

    if (ids.length > 0 && hasCompleteImmediateToolResponses(messages, i, ids)) {
      for (const id of ids) expectedToolCallIds.add(id);
      result.push(message);
      continue;
    }

    const cleaned = { ...record };
    delete cleaned.tool_calls;
    if (cleaned.content === null || cleaned.content === undefined) cleaned.content = '';
    result.push(cleaned);

    while (i + 1 < messages.length) {
      const next = messages[i + 1];
      if (!next || typeof next !== 'object' || Array.isArray(next)) break;
      if ((next as Record<string, unknown>).role !== 'tool') break;
      i += 1;
    }
  }

  return result;
}

function sanitizeOpenAiMessages(
  messages: unknown,
  endpointKey: string,
  model: string,
  reasoningContentLookup?: (firstToolCallId: string) => string | null,
): unknown {
  if (!Array.isArray(messages)) return messages;

  const normalizedMessages = stripIncompleteToolCallBlocks(messages, endpointKey);
  const preserveReasoningContent = supportsReasoningContent(endpointKey, model);
  const preserveReasoningDetails = supportsReasoningDetails(endpointKey);
  const isMistral = endpointKey === 'mistral';
  const mistralIdMap = new Map<string, string>();
  const reservedMistralIds = new Set<string>();
  let generatedMistralIdCounter = 0;

  const reserveMistralToolCallId = (toolCallId: unknown): void => {
    if (!isMistral || typeof toolCallId !== 'string') return;
    if (MISTRAL_TOOL_CALL_ID_REGEX.test(toolCallId)) {
      reservedMistralIds.add(toolCallId);
    }
  };

  if (isMistral) {
    for (const message of normalizedMessages) {
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        continue;
      }
      const rawMessage = message as Record<string, unknown>;
      if (Array.isArray(rawMessage.tool_calls)) {
        for (const toolCall of rawMessage.tool_calls) {
          if (!toolCall || typeof toolCall !== 'object' || Array.isArray(toolCall)) {
            continue;
          }
          reserveMistralToolCallId((toolCall as Record<string, unknown>).id);
        }
      }
      if ('tool_call_id' in rawMessage) {
        reserveMistralToolCallId(rawMessage.tool_call_id);
      }
    }
  }

  const nextGeneratedMistralId = (): string => {
    do {
      generatedMistralIdCounter += 1;
      const candidate = `tc${generatedMistralIdCounter.toString(36).padStart(7, '0')}`;
      if (!reservedMistralIds.has(candidate)) return candidate;
    } while (true);
  };

  const normalizeMistralToolCallId = (toolCallId: unknown): unknown => {
    if (!isMistral || typeof toolCallId !== 'string') return toolCallId;
    const existing = mistralIdMap.get(toolCallId);
    if (existing) return existing;

    if (MISTRAL_TOOL_CALL_ID_REGEX.test(toolCallId)) {
      mistralIdMap.set(toolCallId, toolCallId);
      reservedMistralIds.add(toolCallId);
      return toolCallId;
    }

    const rewritten = nextGeneratedMistralId();
    mistralIdMap.set(toolCallId, rewritten);
    reservedMistralIds.add(rewritten);
    return rewritten;
  };

  return normalizedMessages.map((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return message;
    }

    const cleaned = { ...(message as Record<string, unknown>) };
    if (!preserveReasoningContent) {
      delete cleaned.reasoning_content;
    }
    if (!preserveReasoningDetails) {
      delete cleaned.reasoning_details;
    }

    if (
      preserveReasoningContent &&
      !cleaned.reasoning_content &&
      Array.isArray(cleaned.tool_calls) &&
      cleaned.tool_calls.length > 0 &&
      reasoningContentLookup
    ) {
      const firstToolCall = cleaned.tool_calls[0];
      const firstToolCallId =
        firstToolCall && typeof firstToolCall === 'object' && !Array.isArray(firstToolCall)
          ? (firstToolCall as Record<string, unknown>).id
          : undefined;
      if (typeof firstToolCallId === 'string') {
        const cached = reasoningContentLookup(firstToolCallId);
        if (cached) cleaned.reasoning_content = cached;
      }
    }

    if (isMistral && Array.isArray(cleaned.tool_calls)) {
      cleaned.tool_calls = cleaned.tool_calls.map((toolCall) => {
        if (!toolCall || typeof toolCall !== 'object' || Array.isArray(toolCall)) {
          return toolCall;
        }
        const cleanedToolCall = { ...(toolCall as Record<string, unknown>) };
        cleanedToolCall.id = normalizeMistralToolCallId(cleanedToolCall.id);
        return cleanedToolCall;
      });
    }

    if (isMistral && 'tool_call_id' in cleaned) {
      cleaned.tool_call_id = normalizeMistralToolCallId(cleaned.tool_call_id);
    }

    return cleaned;
  });
}

function normalizeDeepSeekMaxTokens(body: Record<string, unknown>): void {
  if (!('max_tokens' in body)) return;

  const raw = body.max_tokens;
  const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    delete body.max_tokens;
    return;
  }

  body.max_tokens = Math.min(Math.trunc(parsed), DEEPSEEK_MAX_TOKENS_LIMIT);
  if ((body.max_tokens as number) < 1) delete body.max_tokens;
}

/**
 * Strip OpenAI-specific fields and normalise `max_completion_tokens` -> `max_tokens`
 * for providers that use the OpenAI format but reject unknown fields.
 */
export function sanitizeOpenAiBody(
  body: Record<string, unknown>,
  endpointKey: string,
  model: string,
  reasoningContentLookup?: (firstToolCallId: string) => string | null,
): Record<string, unknown> {
  const passthroughTopLevel = PASSTHROUGH_PROVIDERS.has(endpointKey);

  // Strip vendor prefix (e.g., "openai/gpt-5" → "gpt-5") before matching.
  const bareForRegex = model.includes('/') ? model.substring(model.indexOf('/') + 1) : model;
  const needsMaxCompletionTokens = usesOpenAiMaxCompletionTokens(endpointKey, bareForRegex);
  const convertMaxTokens =
    needsMaxCompletionTokens && 'max_tokens' in body && !('max_completion_tokens' in body);

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'messages') {
      cleaned[key] = sanitizeOpenAiMessages(value, endpointKey, model, reasoningContentLookup);
      continue;
    }
    // Rewrite max_tokens → max_completion_tokens for OpenAI-backed endpoints that
    // require it (native OpenAI + Copilot for o-series / GPT-5+). Applies in both
    // passthrough and non-passthrough branches.
    if (convertMaxTokens && key === 'max_tokens') {
      cleaned['max_completion_tokens'] = value;
      continue;
    }
    if (passthroughTopLevel) {
      cleaned[key] = value;
      continue;
    }
    if (OPENAI_ONLY_FIELDS.has(key)) continue;
    if (key === 'max_completion_tokens') {
      // Preserve max_completion_tokens for endpoints that require it; otherwise
      // downconvert to max_tokens for OpenAI-compatible providers that only know
      // the legacy field name.
      if (needsMaxCompletionTokens) {
        cleaned[key] = value;
      } else if (!('max_tokens' in body)) {
        cleaned['max_tokens'] = value;
      }
      continue;
    }
    cleaned[key] = value;
  }
  if (endpointKey === 'deepseek') normalizeDeepSeekMaxTokens(cleaned);
  return cleaned;
}
