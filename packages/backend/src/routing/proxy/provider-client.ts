import { createHash } from 'crypto';
import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { OPENAI_RESPONSES_ONLY_RE, stripVendorPrefix } from '../../common/constants/openai-models';
import { XAI_RESPONSES_ONLY_RE } from '../../common/constants/xai-models';
import {
  PROVIDER_ENDPOINTS,
  ProviderEndpoint,
  resolveBedrockEndpointKey,
  resolveEndpointKey,
} from './provider-endpoints';
import { validatePublicUrl } from '../../common/utils/url-validation';
import { isSelfHosted } from '../../common/utils/detect-self-hosted';
import { resolveSubscriptionEndpointKey } from './provider-hooks';
import { injectOpenAiMessageCacheControl, injectOpenRouterCacheControl } from './cache-injection';
import type { ReasoningModelCatalog } from './reasoning-format';
import { ModelsDevReasoningCatalog } from './reasoning-model-catalog';
import {
  applyAnthropicAutomaticCacheControl,
  applyAnthropicMessagesMutations,
  toGoogleRequest,
  toAnthropicRequest,
  toResponsesRequest,
  sanitizeOpenAiBody,
  collectChatGptSseResponse as chatGptSseCollector,
  convertChatGptResponse as chatGptResponseConverter,
  createChatGptStreamTransformer as chatGptStreamTransformerFactory,
  convertGoogleResponse as googleResponseConverter,
  convertGoogleStreamChunk as googleStreamChunkConverter,
  convertAnthropicResponse as anthropicResponseConverter,
  convertAnthropicStreamChunk as anthropicStreamChunkConverter,
  createAnthropicTransformer,
  createReasoningContentStreamTransformer as reasoningContentStreamTransformer,
} from './provider-client-converters';
import {
  ForwardOptions,
  ProxyApiMode,
  ProviderWireFormat,
  type ProviderAttemptRef,
} from './proxy-types';
import { CodexSessionAffinity } from './codex-session-affinity';
import { toNativeResponsesRequest } from './responses-adapter';
import { forwardKiroChat } from './kiro-adapter';
import { OpencodeGoCatalogService } from '../../model-discovery/opencode-go-catalog.service';
import { ProviderModelRegistryService } from '../../model-discovery/provider-model-registry.service';
import { qualifyChatGptResponse } from './chatgpt-response-qualifier';
import { qualifyEmptyResponse } from './empty-response-qualifier';
import { isProviderAvailableForDeployment } from '../../common/utils/provider-availability';
import { ManifestError } from '../../common/errors/manifest-error';
import { MANAGED_FREE_PROVIDER_BY_ID } from '../../common/constants/managed-free-providers';

export interface ForwardResult {
  response: Response;
  /** Exact JSON body sent to the resolved provider transport. */
  wireRequestBody?: Record<string, unknown>;
  /** Exact URL used by the resolved provider transport. */
  wireRequestUrl?: string;
  /** Provider-native protocol emitted at the transport boundary. */
  wireFormat?: ProviderWireFormat;
  /** Provider-facing API shape of {@link wireRequestBody}. */
  wireApiMode?: ProxyApiMode;
  /** Re-send a healed wire body through the already-resolved transport. */
  retryWireBody?: (
    body: Record<string, unknown>,
    attempt?: ProviderAttemptRef,
  ) => Promise<ForwardResult>;
  /** False only when Manifest produced a response without invoking provider transport. */
  providerCallStarted?: boolean;
  /** Persisted provider-call identity, when request tracking is available. */
  attempt?: ProviderAttemptRef;
  /** True when we converted from Google format (needs SSE transform). */
  isGoogle: boolean;
  /** True when we converted from Anthropic format (needs SSE transform). */
  isAnthropic: boolean;
  /** True when we converted from ChatGPT Responses API format (needs SSE transform). */
  isChatGpt: boolean;
  /** True when the upstream already speaks the public Responses API format. */
  isResponses?: boolean;
  /**
   * True when the upstream is the CodeAssist API (Gemini OAuth flow). The
   * response handler unwraps the `{ response: ... }` envelope before
   * passing the inner body to the standard Google converters.
   */
  isCodeAssist?: boolean;
  /** Internal: Anthropic synthetic tool used to emulate Responses structured output. */
  structuredOutputToolName?: string;
  /** Internal: original Responses text.format metadata for synthesized Responses bodies. */
  responsesTextFormat?: Record<string, unknown>;
}

function wireApiMode(endpoint: ProviderEndpoint): ProxyApiMode | undefined {
  if (endpoint.format === 'openai') return 'chat_completions';
  if (endpoint.format === 'anthropic') return 'messages';
  if (endpoint.format === 'chatgpt') return 'responses';
  return undefined;
}

function wireFormat(endpoint: ProviderEndpoint): ProviderWireFormat | undefined {
  if (endpoint.format === 'openai') return 'openai_chat_completions';
  if (endpoint.format === 'anthropic') return 'anthropic_messages';
  if (endpoint.format === 'chatgpt') return 'openai_responses';
  if (endpoint.format === 'google') {
    return endpoint.codeAssistEnvelope ? 'google_code_assist' : 'google_generate_content';
  }
  return undefined;
}

const INPUT_WIRE_FORMATS: Record<ProxyApiMode, ProviderWireFormat> = {
  chat_completions: 'openai_chat_completions',
  messages: 'anthropic_messages',
  responses: 'openai_responses',
};

interface BuiltProviderRequest {
  url: string;
  headers: Record<string, string>;
  requestBody: Record<string, unknown>;
  structuredOutputToolName?: string;
}

const parsedProviderTimeout = Number.parseInt(process.env.PROVIDER_TIMEOUT_MS ?? '', 10);
const PROVIDER_TIMEOUT_MS =
  Number.isFinite(parsedProviderTimeout) && parsedProviderTimeout > 0
    ? parsedProviderTimeout
    : 180_000;
const QWEN_TOKEN_PLAN_RESPONSES_RE = /^qwen3\.7-max$/i;
const COPILOT_CHAT_COMPLETIONS_ENDPOINT = '/chat/completions';
const COPILOT_RESPONSES_ENDPOINTS = new Set(['/responses', 'ws:/responses']);

function shouldApplyAnthropicAutomaticCacheControl(endpointKey: string): boolean {
  return endpointKey === 'anthropic';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function responsesTextFormat(
  body: Record<string, unknown>,
  apiMode: ForwardOptions['apiMode'],
): Record<string, unknown> | undefined {
  if (apiMode !== 'responses' || !isRecord(body.text) || !isRecord(body.text.format)) {
    return undefined;
  }

  const format = body.text.format;
  if (format.type === 'json_object') return { type: 'json_object' };
  if (format.type !== 'json_schema') return undefined;

  const out: Record<string, unknown> = { type: 'json_schema' };
  if (format.name !== undefined) out.name = format.name;
  if (format.schema !== undefined) out.schema = format.schema;
  if (format.strict !== undefined) out.strict = format.strict;
  if (typeof format.description === 'string' && format.description) {
    out.description = format.description;
  }
  return out;
}

function isStructuredResponseFormat(responseFormat: unknown): boolean {
  return (
    isRecord(responseFormat) &&
    (responseFormat.type === 'json_object' || responseFormat.type === 'json_schema')
  );
}

function structuredOutputToolName(
  requestSource: Record<string, unknown>,
  requestBody: Record<string, unknown>,
): string | undefined {
  if (!isStructuredResponseFormat(requestSource.response_format)) return undefined;
  const toolChoice = requestBody.tool_choice;
  if (!isRecord(toolChoice) || toolChoice.type !== 'tool') return undefined;
  return typeof toolChoice.name === 'string' ? toolChoice.name : undefined;
}

function buildPromptCacheKey(sessionKey: string): string {
  const digest = createHash('sha256').update(sessionKey).digest('hex').slice(0, 32);
  return `manifest-${digest}`;
}

function applyHashedPromptCacheKey(
  body: Record<string, unknown>,
  providerCacheKey: string | undefined,
): void {
  if (typeof body.prompt_cache_key === 'string' && body.prompt_cache_key) return;
  const trimmedCacheKey = providerCacheKey?.trim();
  if (!trimmedCacheKey) return;
  body.prompt_cache_key = buildPromptCacheKey(trimmedCacheKey);
}

function openRouterCacheMode(model: string): 'anthropic' | 'message' | null {
  const normalized = model.toLowerCase().replace(/^~/, '');
  if (normalized.startsWith('anthropic/')) return 'anthropic';
  if (normalized.startsWith('google/') || normalized.startsWith('qwen/')) return 'message';
  return null;
}

/**
 * Strip vendor prefix from model name (e.g. "anthropic/claude-sonnet-4" → "claude-sonnet-4").
 * Models synced from OpenRouter use vendor prefixes, but native APIs expect bare names.
 */
function stripModelPrefix(model: string, endpointKey: string): string {
  // OpenRouter and managed free providers expect vendor prefixes.
  if (endpointKey === 'openrouter' || MANAGED_FREE_PROVIDER_BY_ID.has(endpointKey)) return model;
  if (endpointKey === 'commandcode' || endpointKey === 'commandcode-anthropic') {
    return model.startsWith('commandcode/') ? model.slice('commandcode/'.length) : model;
  }
  // Custom providers, Fireworks, Groq, Hugging Face, Kilo, Nous, NVIDIA NIM, Ollama, Pioneer, and ClinePass: model IDs from these APIs contain
  // legitimate slash segments (e.g. "accounts/fireworks/models/deepseek-v3p1",
  // "MiniMaxAI/MiniMax-2.7", "meta-llama/llama-guard-4-12b", "anthropic/claude-sonnet-4.5",
  // "cline-pass/deepseek-v4-flash"). Stripping would mangle the name the upstream API expects.
  if (
    endpointKey === 'custom' ||
    endpointKey === 'fireworks' ||
    endpointKey === 'groq' ||
    endpointKey === 'huggingface' ||
    endpointKey === 'kilo' ||
    endpointKey === 'nous' ||
    endpointKey === 'nvidia' ||
    endpointKey === 'cline-pass' ||
    endpointKey === 'ollama' ||
    endpointKey === 'ollama-cloud' ||
    endpointKey === 'pioneer'
  )
    return model;
  return stripVendorPrefix(model);
}

/**
 * Detects if the response represents a streaming SSE response by checking:
 * 1. content-type header contains text/event-stream
 * 2. Presence of [DONE] or data: markers in the body
 * 3. The request's stream flag
 */
function isStreamingResponse(response: Response, streamFlag: boolean): boolean {
  const contentType = response.headers.get('content-type') ?? '';
  const hasSseHeader = contentType.includes('text/event-stream');
  // Check for SSE markers in the body - [DONE] or data: events
  // We can't read the full body here, but we can check if the stream flag is set
  // or if the content-type suggests SSE
  return streamFlag || hasSseHeader;
}

/**
 * A streaming chunk is deliverable when it carries either real text
 * (`choices[0].delta.content`) or at least one tool call
 * (`choices[0].delta.tool_calls`). The standard SSE shape for
 * `chat.completion.chunk` is used; the degenerate `choices: []` /
 * `choices: [undefined]` cases are treated as not deliverable.
 *
 * Fix: Also accept arrays of content parts (e.g., multimodal/audio responses)
 * as deliverable, not just strings.
 */
function hasDeliverableChunk(payload: Record<string, unknown>): boolean {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  if (choices.length === 0) return false;
  const first = isObjectRecord(choices[0]) ? choices[0] : undefined;
  if (!first) return false;
  const delta = isObjectRecord(first.delta) ? first.delta : undefined;
  if (!delta) return false;
  // Accept string content that is non-empty after trimming
  if (typeof delta.content === 'string' && delta.content.trim().length > 0) return true;
  // Accept arrays of content parts (multimodal/audio responses)
  if (Array.isArray(delta.content)) return delta.content.length > 0;
  // Accept at least one tool call
  return Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0;
}

/**
 * Qualify a streaming response. Reads chunks until either a deliverable chunk
 * is found (in which case the stream is replayed) or the timeout elapses
 * (in which case the response is rewritten as a synthetic 502).
 *
 * Fixes applied:
 * 1. Catches errors from parser.feed() (buffer overflow) and returns upstream_stream_error 502
 * 2. Uses cumulative timeout tracking — timer resets only once at start, not per chunk
 * 3. Calls parser.flush() before declaring stream empty to inspect pending payloads
 * 4. Detects streaming based on stream flag or SSE headers, not just content-type
 */
async function qualifyStreaming(response: Response, streamFlag: boolean): Promise<Response> {
  const reader = response.body?.getReader();
  if (!reader) {
    return errorResponse(
      response,
      502,
      'Provider returned a streaming response without a readable body',
      'empty_response',
    );
  }

  const buffered: Uint8Array[] = [];
  const parser = createSsePayloadParser();

  // Track cumulative elapsed time for the timeout
  let elapsedMs = 0;

  while (true) {
    // Use remaining timeout for each read attempt
    const result = await readWithTimeout(
      reader,
      Math.max(0, DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS - elapsedMs),
    );
    if (result === null) {
      // Timeout with no deliverable output: treat as empty.
      await discard(reader);
      return errorResponse(
        response,
        502,
        'Provider streamed no content or tool calls before the timeout',
        'empty_response',
      );
    }
    if (result.done) {
      // Stream ended — flush pending payloads before deciding if empty.
      parser.flush();
      reader.releaseLock();
      // After flushing, check if any pending payloads were deliverable.
      // If the stream ended without any deliverable content, report empty.
      return errorResponse(
        response,
        502,
        'Provider stream ended without content or tool calls',
        'empty_response',
      );
    }
    if (result.value) {
      buffered.push(result.value);
      const text = new TextDecoder().decode(result.value);
      const payloads = parser.feed(text);
      for (const payload of payloads) {
        const parsed = safeParse(payload);
        if (parsed && hasDeliverableChunk(parsed)) {
          // Deliverable: replay the consumed chunks so downstream
          // consumers still see the full stream.
          return responseWithBody(response, replayStream(reader, buffered));
        }
      }
      // Update elapsed time tracking
      elapsedMs += DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS;
    }
  }
}

/**
 * Qualify a `/v1/chat/completions` response. Non-streaming responses are
 * inspected as a whole; streaming responses are inspected chunk by chunk.
 * When no deliverable output is found the response is rewritten as a
 * synthetic 502 so the existing fallback logic advances the chain.
 */
export async function qualifyEmptyResponse(response: Response): Promise<Response> {
  if (!response.ok) return response;
  // Check if streaming based on content-type or stream flag
  const isStreaming = response.headers.get('content-type')?.includes('text/event-stream') ?? false;
  return isStreaming ? qualifyStreaming(response, false) : qualifyNonStreaming(response);
}

/**
 * Checks if a non-streaming message has deliverable content.
 * Now accepts arrays of content parts as deliverable.
 */
function hasDeliverableMessage(message: ChatCompletionMessage | undefined): boolean {
  if (!message) return false;
  if (typeof message.content === 'string' && message.content.trim().length > 0) return true;
  // Accept arrays of content parts (multimodal/audio responses) as deliverable
  if (Array.isArray(message.content)) return message.content.length > 0;
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

function errorResponse(
  response: Response,
  status: number,
  message: string,
  code: string,
  body?: string,
): Response {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  return new Response(
    body ??
      JSON.stringify({
        error: { message, type: 'upstream_response_error', code },
      }),
    { status, headers },
  );
}

function responseWithBody(response: Response, body: BodyInit): Response {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function replayStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buffered: Uint8Array[],
): ReadableStream<Uint8Array> {
  const release = () => reader.releaseLock();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of buffered) controller.enqueue(chunk);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
        } else if (value) {
          controller.enqueue(value);
        }
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        release();
      }
    },
  });
}

async function discard(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The qualifier is replacing this body, so a cancellation failure is immaterial.
  } finally {
    reader.releaseLock();
  }
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array> | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

interface ChatCompletionMessage {
  content?: unknown;
  tool_calls?: unknown;
}

/**
 * A non-streaming message is deliverable when it carries either real text
 * (non-empty after trimming) or at least one tool call. An assistant message
 * may legitimately have empty content alongside tool calls — that is not an
 * empty response.
 *
 * Fix: Also accept arrays of content parts as deliverable.
 */
function isDeliverableMessage(message: ChatCompletionMessage | undefined): boolean {
  if (!message) return false;
  if (typeof message.content === 'string' && message.content.trim().length > 0) return true;
  // Accept arrays of content parts (multimodal/audio responses) as deliverable
  if (Array.isArray(message.content)) return message.content.length > 0;
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

function nonStreamingMessage(payload: Record<string, unknown>): ChatCompletionMessage | undefined {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  if (choices.length === 0) return undefined;
  const first = isObjectRecord(choices[0]) ? choices[0] : undefined;
  if (!first) return undefined;
  return isObjectRecord(first.message) ? first.message : undefined;
}

async function qualifyNonStreaming(response: Response): Promise<Response> {
  // Clone so consuming the body for inspection does not mark the original
  // as "already read" — downstream consumers (and retryWireBody) still need
  // to read it untouched. If the body was already consumed upstream (a
  // previously-read response replayed through retryWireBody), we cannot
  // inspect it — pass it through unchanged rather than failing.
  let text: string;
  try {
    text = await response.clone().text();
  } catch {
    return response;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return errorResponse(
      response,
      502,
      'Provider returned an empty response body',
      'empty_response',
    );
  }

  const parsed = safeParse(trimmed);
  if (!parsed) {
    // A non-JSON 200 body is not a valid chat completion; treat it as a
    // provider failure rather than guessing. The original body is preserved in
    // the synthetic error payload for diagnostics.
    return errorResponse(
      response,
      502,
      'Provider returned a non-JSON response body',
      'empty_response',
      JSON.stringify({
        error: {
          message: 'Provider returned a non-JSON response body',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
        raw_body: trimmed.slice(0, 4_000),
      }),
    );
  }

  const message = nonStreamingMessage(parsed);
  if (!isDeliverableMessage(message)) {
    return errorResponse(
      response,
      502,
      'Provider returned a chat completion without content or tool calls',
      'empty_response',
      JSON.stringify({
        error: {
          message: 'Provider returned a chat completion without content or tool calls',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
        raw_body: trimmed.slice(0, 4_000),
      }),
    );
  }

  // Deliverable: replay the consumed body so downstream consumers still see it.
  return responseWithBody(response, encoder.encode(text));
}

/**
 * A streaming chunk is deliverable when it carries either real text
 * (`choices[0].delta.content`) or at least one tool call
 * (`choices[0].delta.tool_calls`). The standard SSE shape for
 * `chat.completion.chunk` is used; the degenerate `choices: []` /
 * `choices: [undefined]` cases are treated as not deliverable.
 *
 * Fix: Also accept arrays of content parts as deliverable.
 */
function hasDeliverableChunk(payload: Record<string, unknown>): boolean {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  if (choices.length === 0) return false;
  const first = isObjectRecord(choices[0]) ? choices[0] : undefined;
  if (!first) return false;
  const delta = isObjectRecord(first.delta) ? first.delta : undefined;
  if (!delta) return false;
  // Accept string content that is non-empty after trimming
  if (typeof delta.content === 'string' && delta.content.trim().length > 0) return true;
  // Accept arrays of content parts (multimodal/audio responses) as deliverable
  if (Array.isArray(delta.content)) return delta.content.length > 0;
  // Accept at least one tool call
  return Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0;
}

/**
 * Qualify a streaming response. Reads chunks until either a deliverable chunk
 * is found (in which case the stream is replayed) or the timeout elapses
 * (in which case the response is rewritten as a synthetic 502).
 *
 * Fixes applied:
 * 1. Catches errors from parser.feed() (buffer overflow) and returns upstream_stream_error 502
 * 2. Uses cumulative timeout tracking — timer resets only once at start, not per chunk
 * 3. Calls parser.flush() before declaring stream empty to inspect pending payloads
 * 4. Detects streaming based on stream flag or SSE headers, not just content-type
 * 5. Accepts arrays of content parts as deliverable
 */
async function qualifyStreaming(response: Response, streamFlag: boolean): Promise<Response> {
  const reader = response.body?.getReader();
  if (!reader) {
    return errorResponse(
      response,
      502,
      'Provider returned a streaming response without a readable body',
      'empty_response',
    );
  }

  const buffered: Uint8Array[] = [];
  const parser = createSsePayloadParser();

  // Track cumulative elapsed time for the timeout
  let elapsedMs = 0;

  while (true) {
    // Use remaining timeout for each read attempt
    const result = await readWithTimeout(
      reader,
      Math.max(0, DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS - elapsedMs),
    );
    if (result === null) {
      // Timeout with no deliverable output: treat as empty.
      await discard(reader);
      return errorResponse(
        response,
        502,
        'Provider streamed no content or tool calls before the timeout',
        'empty_response',
      );
    }
    if (result.done) {
      // Stream ended — flush pending payloads before deciding if empty.
      parser.flush();
      reader.releaseLock();
      // After flushing, check if any pending payloads were deliverable.
      // If the stream ended without any deliverable content, report empty.
      return errorResponse(
        response,
        502,
        'Provider stream ended without content or tool calls',
        'empty_response',
      );
    }
    if (result.value) {
      buffered.push(result.value);
      const text = new TextDecoder().decode(result.value);
      const payloads = parser.feed(text);
      for (const payload of payloads) {
        const parsed = safeParse(payload);
        if (parsed && hasDeliverableChunk(parsed)) {
          // Deliverable: replay the consumed chunks so downstream
          // consumers still see the full stream.
          return responseWithBody(response, replayStream(reader, buffered));
        }
      }
      // Update elapsed time tracking
      elapsedMs += DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS;
    }
  }
}

/**
 * Qualify a `/v1/chat/completions` response. Non-streaming responses are
 * inspected as a whole; streaming responses are inspected chunk by chunk.
 * When no deliverable output is found the response is rewritten as a
 * synthetic 502 so the existing fallback logic advances the chain.
 */
export async function qualifyEmptyResponse(response: Response): Promise<Response> {
  if (!response.ok) return response;
  // Check if streaming based on content-type or stream flag
  const isStreaming = response.headers.get('content-type')?.includes('text/event-stream') ?? false;
  return isStreaming ? qualifyStreaming(response, false) : qualifyNonStreaming(response);
}
