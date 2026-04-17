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
export type { SignatureLookup, ThinkingBlockLookup } from './proxy-types';

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

function supportsReasoningContent(endpointKey: string, model: string): boolean {
  if (endpointKey === 'deepseek') return true;
  if (endpointKey === 'openrouter') return model.toLowerCase().startsWith('deepseek/');
  return false;
}

function sanitizeOpenAiMessages(messages: unknown, endpointKey: string, model: string): unknown {
  if (!Array.isArray(messages)) return messages;

  const preserveReasoningContent = supportsReasoningContent(endpointKey, model);
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
): Record<string, unknown> {
  const passthroughTopLevel = PASSTHROUGH_PROVIDERS.has(endpointKey);

  // For OpenAI models that require max_completion_tokens, convert before passthrough.
  // Strip vendor prefix (e.g., "openai/gpt-5" → "gpt-5") before matching.
  const bareForRegex = model.includes('/') ? model.substring(model.indexOf('/') + 1) : model;
  const convertMaxTokens =
    endpointKey === 'openai' &&
    OPENAI_MAX_COMPLETION_TOKENS_RE.test(bareForRegex) &&
    'max_tokens' in body &&
    !('max_completion_tokens' in body);

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'messages') {
      cleaned[key] = sanitizeOpenAiMessages(value, endpointKey, model);
      continue;
    }
    if (passthroughTopLevel) {
      // Convert max_tokens → max_completion_tokens for newer OpenAI models
      if (convertMaxTokens && key === 'max_tokens') {
        cleaned['max_completion_tokens'] = value;
        continue;
      }
      cleaned[key] = value;
      continue;
    }
    if (OPENAI_ONLY_FIELDS.has(key)) continue;
    if (key === 'max_completion_tokens') {
      // Convert to max_tokens unless already set
      if (!('max_tokens' in body)) cleaned['max_tokens'] = value;
      continue;
    }
    cleaned[key] = value;
  }
  if (endpointKey === 'deepseek') normalizeDeepSeekMaxTokens(cleaned);
  return cleaned;
}
