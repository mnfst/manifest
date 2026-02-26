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

export interface ForwardResult {
  response: Response;
  /** True when we converted from Google format (needs SSE transform). */
  isGoogle: boolean;
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
  ): Promise<ForwardResult> {
    const endpointKey = resolveEndpointKey(provider);
    if (!endpointKey) {
      throw new Error(`No endpoint configured for provider: ${provider}`);
    }

    const endpoint = PROVIDER_ENDPOINTS[endpointKey];
    const isGoogle = endpoint.format === 'google';

    let url: string;
    let headers: Record<string, string>;
    let requestBody: Record<string, unknown>;

    if (isGoogle) {
      url = `${endpoint.baseUrl}${endpoint.buildPath(model)}?key=${apiKey}`;
      if (stream) url += '&alt=sse';
      headers = endpoint.buildHeaders(apiKey);
      requestBody = toGoogleRequest(body, model);
    } else {
      url = `${endpoint.baseUrl}${endpoint.buildPath(model)}`;
      headers = endpoint.buildHeaders(apiKey);
      requestBody = { ...body, model, stream };
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

    return { response, isGoogle };
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
}
