import { Injectable, Logger } from '@nestjs/common';
import {
  PROVIDER_ENDPOINTS,
  resolveEndpointKey,
} from './provider-endpoints';

export interface ForwardResult {
  response: Response;
}

const PROVIDER_TIMEOUT_MS = 600_000;

@Injectable()
export class ProviderClient {
  private readonly logger = new Logger(ProviderClient.name);

  async forward(
    provider: string,
    apiKey: string,
    model: string,
    body: Record<string, unknown>,
    stream: boolean,
  ): Promise<ForwardResult> {
    const endpointKey = resolveEndpointKey(provider);
    if (!endpointKey) {
      throw new Error(`No endpoint configured for provider: ${provider}`);
    }

    const endpoint = PROVIDER_ENDPOINTS[endpointKey];
    const url = `${endpoint.baseUrl}${endpoint.buildPath(model)}`;
    const headers = endpoint.buildHeaders(apiKey);
    const requestBody = { ...body, model, stream };

    this.logger.debug(`Forwarding to ${endpointKey}: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    return { response };
  }
}
