import { Injectable, Logger } from '@nestjs/common';
import { PROVIDER_ENDPOINTS, ProviderEndpoint, resolveEndpointKey } from './provider-endpoints';
import { toGoogleRequest, fromGoogleResponse, transformGoogleStreamChunk } from './google-adapter';
import {
  toAnthropicRequest,
  fromAnthropicResponse,
  transformAnthropicStreamChunk,
  createAnthropicStreamTransformer,
} from './anthropic-adapter';
import { injectOpenRouterCacheControl } from './cache-injection';

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

function supportsReasoningContent(endpointKey: string, model: string): boolean {
  if (endpointKey === 'deepseek') return true;
  if (endpointKey === 'openrouter') return model.toLowerCase().startsWith('deepseek/');
  return false;
}

function sanitizeOpenAiMessages(messages: unknown, endpointKey: string, model: string): unknown {
  if (!Array.isArray(messages)) return messages;

  const preserveReasoningContent = supportsReasoningContent(endpointKey, model);
  return messages.map((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return message;
    }

    const cleaned = { ...(message as Record<string, unknown>) };
    if (!preserveReasoningContent) {
      delete cleaned.reasoning_content;
    }
    return cleaned;
  });
}

/**
 * Strip OpenAI-specific fields and normalise `max_completion_tokens` → `max_tokens`
 * for providers that use the OpenAI format but reject unknown fields.
 */
function sanitizeOpenAiBody(
  body: Record<string, unknown>,
  endpointKey: string,
  model: string,
): Record<string, unknown> {
  const passthroughTopLevel = PASSTHROUGH_PROVIDERS.has(endpointKey);

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'messages') {
      cleaned[key] = sanitizeOpenAiMessages(value, endpointKey, model);
      continue;
    }
    if (passthroughTopLevel) {
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
  return cleaned;
}

export interface ForwardResult {
  response: Response;
  /** True when we converted from Google format (needs SSE transform). */
  isGoogle: boolean;
  /** True when we converted from Anthropic format (needs SSE transform). */
  isAnthropic: boolean;
}

const PROVIDER_TIMEOUT_MS = 180_000;

/**
 * Strip vendor prefix from model name (e.g. "anthropic/claude-sonnet-4" → "claude-sonnet-4").
 * Models synced from OpenRouter use vendor prefixes, but native APIs expect bare names.
 */
function stripModelPrefix(model: string, endpointKey: string): string {
  // OpenRouter accepts and expects vendor prefixes
  if (endpointKey === 'openrouter') return model;
  const slashIdx = model.indexOf('/');
  return slashIdx > 0 ? model.substring(slashIdx + 1) : model;
}

@Injectable()
export class ProviderClient {
  private readonly logger = new Logger(ProviderClient.name);

  async forward(
    provider: string,
    apiKey: string,
    model: string,
    body: Record<string, unknown>,
    stream: boolean,
    signal?: AbortSignal,
    extraHeaders?: Record<string, string>,
    customEndpoint?: ProviderEndpoint,
    authType?: string,
  ): Promise<ForwardResult> {
    let endpoint: ProviderEndpoint;
    let endpointKey: string;

    if (customEndpoint) {
      endpoint = customEndpoint;
      endpointKey = 'custom';
    } else {
      const resolved = resolveEndpointKey(provider);
      if (!resolved) {
        throw new Error(`No endpoint configured for provider: ${provider}`);
      }
      endpointKey = resolved;
      endpoint = PROVIDER_ENDPOINTS[endpointKey];
    }
    const isGoogle = endpoint.format === 'google';
    const isAnthropic = endpoint.format === 'anthropic';

    const bareModel = stripModelPrefix(model, endpointKey);
    let url: string;
    let headers: Record<string, string>;
    let requestBody: Record<string, unknown>;

    if (isGoogle) {
      url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}?key=${apiKey}`;
      if (stream) url += '&alt=sse';
      headers = endpoint.buildHeaders(apiKey, authType);
      requestBody = toGoogleRequest(body, bareModel);
    } else if (isAnthropic) {
      url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}`;
      headers = endpoint.buildHeaders(apiKey, authType);
      requestBody = toAnthropicRequest(body, bareModel);
      requestBody.model = bareModel;
      if (stream) requestBody.stream = true;
    } else {
      url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}`;
      headers = endpoint.buildHeaders(apiKey, authType);
      const sanitized = sanitizeOpenAiBody(body, endpointKey, model);
      requestBody = { ...sanitized, model: bareModel, stream };

      // Inject cache_control for OpenRouter requests targeting Anthropic models
      if (endpointKey === 'openrouter' && model.startsWith('anthropic/')) {
        injectOpenRouterCacheControl(requestBody);
      }
    }

    if (extraHeaders) {
      headers = { ...headers, ...extraHeaders };
    }

    const safeUrl = url.replace(/key=[^&]+/, 'key=***');
    this.logger.debug(`Forwarding to ${endpointKey}: ${safeUrl}`);

    const timeoutSignal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
    const fetchSignal = signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: fetchSignal,
    });

    return { response, isGoogle, isAnthropic };
  }

  /** Convert a Google non-streaming response to OpenAI format. */
  convertGoogleResponse(
    googleBody: Record<string, unknown>,
    model: string,
  ): Record<string, unknown> {
    return fromGoogleResponse(googleBody, model);
  }

  /** Convert a Google SSE chunk to OpenAI SSE format. */
  convertGoogleStreamChunk(chunk: string, model: string): string | null {
    return transformGoogleStreamChunk(chunk, model);
  }

  /** Convert an Anthropic non-streaming response to OpenAI format. */
  convertAnthropicResponse(
    anthropicBody: Record<string, unknown>,
    model: string,
  ): Record<string, unknown> {
    return fromAnthropicResponse(anthropicBody, model);
  }

  /** Convert an Anthropic SSE chunk to OpenAI SSE format. */
  convertAnthropicStreamChunk(chunk: string, model: string): string | null {
    return transformAnthropicStreamChunk(chunk, model);
  }

  /** Create a stateful Anthropic stream transformer that tracks usage across events. */
  createAnthropicStreamTransformer(model: string): (chunk: string) => string | null {
    return createAnthropicStreamTransformer(model);
  }
}
