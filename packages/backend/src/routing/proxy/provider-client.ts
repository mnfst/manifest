import { Injectable, Logger } from '@nestjs/common';
import {
  PROVIDER_ENDPOINTS,
  resolveEndpointKey,
} from './provider-endpoints';
import {
  toGoogleRequest,
  fromGoogleResponse,
  transformGoogleStreamChunk,
} from './google-adapter';
import {
  toAnthropicRequest,
  fromAnthropicResponse,
  transformAnthropicStreamChunk,
  createAnthropicStreamTransformer,
} from './anthropic-adapter';
import { injectOpenRouterCacheControl } from './cache-injection';

export interface ForwardResult {
  response: Response;
  /** True when we converted from Google format (needs SSE transform). */
  isGoogle: boolean;
  /** True when we converted from Anthropic format (needs SSE transform). */
  isAnthropic: boolean;
}

const PROVIDER_TIMEOUT_MS = 180_000;

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
  ): Promise<ForwardResult> {
    const endpointKey = resolveEndpointKey(provider);
    if (!endpointKey) {
      throw new Error(`No endpoint configured for provider: ${provider}`);
    }

    const endpoint = PROVIDER_ENDPOINTS[endpointKey];
    const isGoogle = endpoint.format === 'google';
    const isAnthropic = endpoint.format === 'anthropic';

    let url: string;
    let headers: Record<string, string>;
    let requestBody: Record<string, unknown>;

    if (isGoogle) {
      url = `${endpoint.baseUrl}${endpoint.buildPath(model)}?key=${apiKey}`;
      if (stream) url += '&alt=sse';
      headers = endpoint.buildHeaders(apiKey);
      requestBody = toGoogleRequest(body, model);
    } else if (isAnthropic) {
      url = `${endpoint.baseUrl}${endpoint.buildPath(model)}`;
      headers = endpoint.buildHeaders(apiKey);
      requestBody = toAnthropicRequest(body, model);
      requestBody.model = model;
      if (stream) requestBody.stream = true;
    } else {
      url = `${endpoint.baseUrl}${endpoint.buildPath(model)}`;
      headers = endpoint.buildHeaders(apiKey);
      requestBody = { ...body, model, stream };

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
    const fetchSignal = signal
      ? AbortSignal.any([timeoutSignal, signal])
      : timeoutSignal;

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
