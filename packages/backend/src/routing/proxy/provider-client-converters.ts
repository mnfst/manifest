import {
  toGoogleRequest,
  fromGoogleResponse,
  transformGoogleStreamChunk,
  type GoogleStreamChunkResult,
} from './google-adapter';
import {
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
export { toGoogleRequest, toAnthropicRequest, toResponsesRequest, collectChatGptSseResponse };
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
 *  - OpenCode Go's known reasoning model families (kimi, deepseek, glm, etc.)
 *  - OpenRouter `deepseek/*` slugs and `moonshotai/*` slugs (Kimi K2 via OpenRouter)
 *  - user-supplied custom providers
 * Strict OpenAI-compatible endpoints (Mistral, native OpenAI, etc.) keep
 * stripping the field even if a community fine-tune slug contains "deepseek".
 */
export function supportsReasoningContent(endpointKey: string, model: string): boolean {
  if (endpointKey === 'deepseek') return true;
  if (endpointKey === 'moonshot') return true;
  if (!REASONING_CONTENT_AWARE_ENDPOINTS.has(endpointKey)) return false;
  const bare = model.toLowerCase().split('/').pop() ?? '';
  if (endpointKey === 'opencode-go') {
    return OPENCODE_GO_REASONING_MODEL_FAMILY_RE.test(bare);
  }
  // openrouter, custom: deepseek family or moonshotai/* (Kimi K2 via OpenRouter)
  return bare.includes('deepseek') || model.toLowerCase().startsWith('moonshotai/');
}

/**
 * Callback fired once per assistant turn when the stream transformer has
 * assembled the complete reasoning_content. The response handler caches it
 * keyed by the first tool_call id for re-injection on the next turn.
 */
export type ReasoningContentCallback = (firstToolCallId: string, content: string) => void;

/**
 * Creates a stateful DeepSeek stream transformer that accumulates
 * reasoning_content across SSE delta chunks and fires a callback when the
 * turn completes (finish_reason: 'tool_calls'). The chunks are passed
 * through unchanged so the client still sees the full reasoning chain.
 *
 * pipeStream strips the `data: ` prefix before calling the transformer and
 * expects the returned string to already include it.
 */
export function createDeepSeekStreamTransformer(
  onReasoningContent?: ReasoningContentCallback,
): (chunk: string) => string | null {
  let accumulatedReasoning = '';
  let firstToolCallId: string | null = null;
  let fired = false;

  const tryFire = () => {
    if (!fired && onReasoningContent && accumulatedReasoning && firstToolCallId) {
      onReasoningContent(firstToolCallId, accumulatedReasoning);
      fired = true;
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
        }
        const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            if (firstToolCallId === null && typeof tc.id === 'string' && tc.id) {
              firstToolCallId = tc.id;
            }
          }
        }
      }

      if (choice?.finish_reason === 'tool_calls') {
        tryFire();
      }
    } catch {
      // Pass non-JSON chunks through unchanged
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

function sanitizeOpenAiMessages(
  messages: unknown,
  endpointKey: string,
  model: string,
  reasoningContentLookup?: (firstToolCallId: string) => string | null,
): unknown {
  if (!Array.isArray(messages)) return messages;

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
    for (const message of messages) {
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

  return messages.map((message) => {
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

    // Re-inject cached reasoning_content for reasoning models that require it.
    // OpenAI-compat clients drop the field when replaying conversation history,
    // so we cache it on the response path and restore it here.
    if (
      preserveReasoningContent &&
      !cleaned.reasoning_content &&
      Array.isArray(cleaned.tool_calls) &&
      cleaned.tool_calls.length > 0 &&
      reasoningContentLookup
    ) {
      const firstToolCallId = (cleaned.tool_calls[0] as Record<string, unknown>).id;
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
    // Strip Manifest-internal fields stashed by inbound adapters (e.g.
    // `_anthropicServerTools` from anthropic-messages-adapter). These are
    // only consumed by toAnthropicRequest; OpenAI-compatible upstreams
    // would reject the unknown parameter.
    if (key.startsWith('_anthropic')) continue;
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
