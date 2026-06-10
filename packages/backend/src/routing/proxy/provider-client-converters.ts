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
import {
  normalizeOpenAiReasoningDelta,
  type OpenAiReasoningStreamFormat,
  supportsReasoningContent,
} from './reasoning-format';

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
const MISTRAL_TOOL_CALL_ID_REGEX = /^[A-Za-z0-9]{9}$/;
const DEEPSEEK_MAX_TOKENS_LIMIT = 8192;

/**
 * DeepSeek reasoning models whose API rejects `tool_choice` when
 * thinking/reasoning mode is active. Strip the field before forwarding.
 */
const DEEPSEEK_REASONING_MODEL_RE = /^(deepseek-(?:v4-pro|reasoner|r1))/i;

/**
 * Endpoints that enforce strict tool-call / tool-result pairing.
 * DeepSeek (all variants) rejects a request when an assistant message
 * contains `tool_calls` that are not ALL answered by subsequent `tool`
 * messages.  Strip any un-answered tool_call entries from the assistant
 * message so the conversation stays coherent rather than crashing.
 */
const STRICT_TOOL_PAIRING_ENDPOINTS = new Set(['deepseek']);

/**
 * Endpoints whose OpenAI-compatible /v1/chat/completions backend supports
 * the `developer` message role in addition to `system`.
 *
 * The `developer` role was added by OpenAI alongside the existing `system`
 * role. Most OpenAI-compatible providers (DeepSeek, Groq, xAI, Mistral,
 * etc.) have not adopted it and reject messages with role='developer'.
 * For those providers we silently remap `developer` → `system`.
 */
const SUPPORTS_DEVELOPER_ROLE = new Set([
  'openai',
  'openai-subscription',
  'openai-responses',
  'openrouter',
  'copilot',
  'copilot-responses',
]);

/**
 * Returns true for endpoints that require every tool_call id in an
 * assistant message to be followed by a matching tool-role message.
 * Applies to native deepseek and to any custom/aggregator endpoint
 * whose model slug belongs to the DeepSeek family.
 */
function requiresStrictToolPairing(endpointKey: string, model: string): boolean {
  const key = endpointKey.startsWith('custom:') ? 'custom' : endpointKey.toLowerCase();
  if (STRICT_TOOL_PAIRING_ENDPOINTS.has(key)) return true;
  // OpenRouter or custom providers routing to a DeepSeek model
  if (key === 'openrouter' || key === 'custom') {
    const bare = model.toLowerCase().split('/').pop() ?? '';
    return bare.startsWith('deepseek');
  }
  return false;
}

/**
 * Returns true for DeepSeek reasoning models whose API rejects `tool_choice`
 * when thinking/reasoning mode is active. Stripping the field is safe because
 * these models can still call tools automatically without an explicit choice.
 */
function isDeepSeekReasoningModel(endpointKey: string, model: string): boolean {
  const key = endpointKey.startsWith('custom:') ? 'custom' : endpointKey.toLowerCase();
  if (key === 'deepseek' || key === 'custom') {
    const bare = model.toLowerCase().split('/').pop() ?? '';
    return DEEPSEEK_REASONING_MODEL_RE.test(bare);
  }
  return false;
}

/**
 * Collect the set of all tool_call_ids that have a matching `tool` response
 * message somewhere later in the array.
 */
function buildAnsweredToolCallIds(messages: unknown[]): Set<string> {
  const answered = new Set<string>();
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) continue;
    const m = msg as Record<string, unknown>;
    if (m.role === 'tool' && typeof m.tool_call_id === 'string') {
      answered.add(m.tool_call_id);
    }
  }
  return answered;
}

/**
 * For strict-pairing endpoints: strip tool_call entries from assistant
 * messages when the corresponding tool-result message is missing.
 * If ALL tool_calls end up stripped, remove the tool_calls field entirely
 * so the message looks like a plain assistant turn.
 */
function enforceToolCallPairing(messages: unknown[]): unknown[] {
  const answered = buildAnsweredToolCallIds(messages);
  return messages.map((msg) => {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return msg;
    const m = msg as Record<string, unknown>;
    if (m.role !== 'assistant' || !Array.isArray(m.tool_calls)) return msg;

    const kept = m.tool_calls.filter((tc) => {
      if (!tc || typeof tc !== 'object' || Array.isArray(tc)) return true;
      const id = (tc as Record<string, unknown>).id;
      return typeof id !== 'string' || answered.has(id);
    });

    if (kept.length === m.tool_calls.length) return msg; // nothing changed
    const patched = { ...m };
    if (kept.length === 0) {
      delete patched.tool_calls;
    } else {
      patched.tool_calls = kept;
    }
    return patched;
  });
}

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

  // For strict-pairing endpoints (DeepSeek family), strip un-answered
  // tool_call entries before any other transformation to prevent the
  // "insufficient tool messages following tool_calls message" error.
  const processedMessages = requiresStrictToolPairing(endpointKey, model)
    ? enforceToolCallPairing(messages)
    : messages;

  const supportsDeveloper = SUPPORTS_DEVELOPER_ROLE.has(endpointKey);
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

  return processedMessages.map((message) => {
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

    // Map developer → system for providers that don't support 'developer' role
    if (cleaned.role === 'developer' && !supportsDeveloper) {
      cleaned.role = 'system';
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
  if (isDeepSeekReasoningModel(endpointKey, model) && 'tool_choice' in cleaned) {
    delete cleaned.tool_choice;
  }
  // A tool_choice without a non-empty tools array is rejected by OpenAI /
  // Anthropic / Copilot ("tools are required when tool choice is specified").
  // This happens e.g. on codex compaction requests that carry tool_choice but
  // no tools. Strip it defensively for every provider.
  if ('tool_choice' in cleaned) {
    const toolsVal = cleaned['tools'];
    if (!Array.isArray(toolsVal) || toolsVal.length === 0) {
      delete cleaned.tool_choice;
    }
  }
  return cleaned;
}
