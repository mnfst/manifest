import {
  toGoogleRequest,
  fromGoogleResponse,
  transformGoogleStreamChunk,
  type GoogleStreamChunkResult,
} from './google-adapter';
import {
  applyAnthropicAutomaticCacheControl,
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
  collectChatGptSseResponse,
} from './chatgpt-adapter';
import {
  normalizeOpenAiReasoningDelta,
  type OpenAiReasoningStreamFormat,
} from './reasoning-format';

/** Convert a ChatGPT Responses API response to OpenAI format. */
export function convertChatGptResponse(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  return fromResponsesResponse(body, model);
}

/**
 * Stateful ChatGPT Responses→OpenAI SSE transformer. Created once per stream
 * so the terminal event can backfill reasoning summaries that never streamed
 * as recognizable deltas.
 */
export { createChatGptStreamTransformer } from './chatgpt-adapter';

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
  applyAnthropicAutomaticCacheControl,
  applyAnthropicMessagesMutations,
  extractThinkingBlocksFromMessagesResponse,
  toGoogleRequest,
  toAnthropicRequest,
  toResponsesRequest,
  collectChatGptSseResponse,
};
export type { GoogleStreamChunkResult } from './google-adapter';
export type { ThinkingBlocksCallback } from './anthropic-adapter';
export type { SignatureLookup, ThinkingBlockLookup } from './proxy-types';

// ─── OpenAI wire normalization (used by ProviderClient.forward) ─────────────

// Keep this layer limited to unconditional wire-format adaptations. Whether a
// provider or model accepts a parameter is request-specific and belongs in
// Autofix, where the provider error can produce a scoped patch.

/**
 * Providers that use `max_completion_tokens` without a legacy alias rewrite.
 */
const PASSTHROUGH_PROVIDERS = new Set(['openai', 'openrouter']);
const MISTRAL_TOOL_CALL_ID_REGEX = /^[A-Za-z0-9]{9}$/;

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

export type ReasoningContentCallback = (firstToolCallId: string, content: string) => void;

/**
 * Creates a stateful OpenAI-compatible stream transformer that passes chunks
 * through unchanged while accumulating reasoning_content for tool-call turns.
 */
export function createReasoningContentStreamTransformer(
  onReasoningContent?: ReasoningContentCallback,
  format: OpenAiReasoningStreamFormat = {
    outputStreamDeltaPaths: ['reasoning_content'],
    clientStreamDeltaPath: 'reasoning_content',
  },
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
    let outChunk = chunk;
    try {
      const parsed = JSON.parse(chunk) as Record<string, unknown>;
      const choice = (parsed.choices as Array<Record<string, unknown>> | undefined)?.[0];
      const delta = choice?.delta as Record<string, unknown> | undefined;

      if (delta) {
        const reasoning = normalizeOpenAiReasoningDelta(delta, format);
        if (reasoning) {
          accumulatedReasoning += reasoning.text;
          if (reasoning.normalized) outChunk = JSON.stringify(parsed);
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

    return `data: ${outChunk}\n\n`;
  };
}

function normalizeOpenAiMessages(messages: unknown, endpointKey: string): unknown {
  if (!Array.isArray(messages)) return messages;

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

    const normalized = { ...(message as Record<string, unknown>) };

    if (isMistral && Array.isArray(normalized.tool_calls)) {
      normalized.tool_calls = normalized.tool_calls.map((toolCall) => {
        if (!toolCall || typeof toolCall !== 'object' || Array.isArray(toolCall)) {
          return toolCall;
        }
        const normalizedToolCall = { ...(toolCall as Record<string, unknown>) };
        normalizedToolCall.id = normalizeMistralToolCallId(normalizedToolCall.id);
        return normalizedToolCall;
      });
    }

    if (isMistral && 'tool_call_id' in normalized) {
      normalized.tool_call_id = normalizeMistralToolCallId(normalized.tool_call_id);
    }

    return normalized;
  });
}

/**
 * Normalize unconditional OpenAI-compatible wire differences. Provider- and
 * model-specific parameter corrections are intentionally left to Autofix.
 */
export function sanitizeOpenAiBody(
  body: Record<string, unknown>,
  endpointKey: string,
  model: string,
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
      cleaned[key] = normalizeOpenAiMessages(value, endpointKey);
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
  return cleaned;
}
