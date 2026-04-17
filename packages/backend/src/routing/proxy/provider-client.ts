import { Injectable, Logger } from '@nestjs/common';
import { PROVIDER_ENDPOINTS, ProviderEndpoint, resolveEndpointKey } from './provider-endpoints';
import { injectOpenRouterCacheControl } from './cache-injection';
import {
  toGoogleRequest,
  toAnthropicRequest,
  toResponsesRequest,
  sanitizeOpenAiBody,
  collectChatGptSseResponse as chatGptSseCollector,
  convertChatGptResponse as chatGptResponseConverter,
  convertChatGptStreamChunk as chatGptStreamChunkConverter,
  convertGoogleResponse as googleResponseConverter,
  convertGoogleStreamChunk as googleStreamChunkConverter,
  convertAnthropicResponse as anthropicResponseConverter,
  convertAnthropicStreamChunk as anthropicStreamChunkConverter,
  createAnthropicTransformer,
  type GoogleStreamChunkResult,
  type ThinkingBlocksCallback,
} from './provider-client-converters';
import { ForwardOptions } from './proxy-types';

export interface ForwardResult {
  response: Response;
  /** True when we converted from Google format (needs SSE transform). */
  isGoogle: boolean;
  /** True when we converted from Anthropic format (needs SSE transform). */
  isAnthropic: boolean;
  /** True when we converted from ChatGPT Responses API format (needs SSE transform). */
  isChatGpt: boolean;
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

  async forward(opts: ForwardOptions): Promise<ForwardResult> {
    const {
      provider,
      apiKey,
      model,
      body,
      stream,
      signal,
      extraHeaders,
      customEndpoint,
      authType,
      signatureLookup,
      thinkingLookup,
    } = opts;

    let endpoint: ProviderEndpoint;
    let endpointKey: string;

    if (customEndpoint) {
      endpoint = customEndpoint;
      endpointKey = 'custom';
    } else {
      let resolved = resolveEndpointKey(provider);
      if (!resolved) {
        throw new Error(`No endpoint configured for provider: ${provider}`);
      }
      // ChatGPT subscription tokens use a different backend endpoint
      if (resolved === 'openai' && authType === 'subscription') {
        resolved = 'openai-subscription';
      } else if (resolved === 'minimax' && authType === 'subscription') {
        resolved = 'minimax-subscription';
      } else if (resolved === 'zai' && authType === 'subscription') {
        resolved = 'zai-subscription';
      } else if (resolved === 'opencode-go') {
        // OpenCode Go uses two different API formats depending on the model:
        // MiniMax models use Anthropic /v1/messages, all others use OpenAI /v1/chat/completions.
        const slashIdx = model.indexOf('/');
        const bare = slashIdx > 0 ? model.substring(slashIdx + 1) : model;
        if (bare.toLowerCase().startsWith('minimax-')) {
          resolved = 'opencode-go-anthropic';
        }
      }
      endpointKey = resolved;
      endpoint = PROVIDER_ENDPOINTS[endpointKey];
    }
    const isGoogle = endpoint.format === 'google';
    const isAnthropic = endpoint.format === 'anthropic';
    const isChatGpt = endpoint.format === 'chatgpt';

    const bareModel = stripModelPrefix(model, endpointKey);
    let url: string;
    let headers: Record<string, string>;
    let requestBody: Record<string, unknown>;

    if (isGoogle) {
      // Google Gemini API requires the key as a URL parameter (not a header).
      // The key is sanitized from debug logs below but may be visible to
      // intermediate proxies between Manifest and Google's API.
      url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}?key=${apiKey}`;
      if (stream) url += '&alt=sse';
      headers = endpoint.buildHeaders(apiKey, authType);
      requestBody = toGoogleRequest(body, bareModel, signatureLookup);
    } else if (isAnthropic) {
      url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}`;
      headers = endpoint.buildHeaders(apiKey, authType);
      const isSubscription = authType === 'subscription';
      requestBody = toAnthropicRequest(body, bareModel, {
        injectCacheControl: !isSubscription,
        injectSubscriptionIdentity: isSubscription,
        thinkingLookup,
      });
      requestBody.model = bareModel;
      if (stream) requestBody.stream = true;
    } else if (isChatGpt) {
      url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}`;
      headers = endpoint.buildHeaders(apiKey, authType);
      requestBody = toResponsesRequest(body, bareModel);
    } else {
      url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}`;
      headers = endpoint.buildHeaders(apiKey, authType);
      const sanitized = sanitizeOpenAiBody(body, endpointKey, model);

      // Inject stream_options.include_usage so providers always send token
      // usage in streaming responses — needed for both DB logging and
      // downstream clients (e.g. OpenClaw context management).
      if (
        stream &&
        (endpointKey === 'openai' ||
          endpointKey === 'openrouter' ||
          endpointKey === 'ollama' ||
          endpointKey === 'ollama-cloud')
      ) {
        const existing =
          typeof sanitized.stream_options === 'object' && sanitized.stream_options !== null
            ? (sanitized.stream_options as Record<string, unknown>)
            : {};
        sanitized.stream_options = { ...existing, include_usage: true };
      }

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

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: fetchSignal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message.replace(/key=[^&\s]+/gi, 'key=***'));
    }

    return { response, isGoogle, isAnthropic, isChatGpt };
  }

  /** Convert a ChatGPT Responses API response to OpenAI format. */
  convertChatGptResponse(body: Record<string, unknown>, model: string): Record<string, unknown> {
    return chatGptResponseConverter(body, model);
  }

  /** Convert a ChatGPT Responses API SSE chunk to OpenAI format. */
  convertChatGptStreamChunk(chunk: string, model: string): string | null {
    return chatGptStreamChunkConverter(chunk, model);
  }

  /** Convert a Google non-streaming response to OpenAI format. */
  convertGoogleResponse(
    googleBody: Record<string, unknown>,
    model: string,
  ): Record<string, unknown> {
    return googleResponseConverter(googleBody, model);
  }

  /** Convert a Google SSE chunk to OpenAI SSE format. */
  convertGoogleStreamChunk(chunk: string, model: string): GoogleStreamChunkResult {
    return googleStreamChunkConverter(chunk, model);
  }

  /** Convert an Anthropic non-streaming response to OpenAI format. */
  convertAnthropicResponse(
    anthropicBody: Record<string, unknown>,
    model: string,
  ): Record<string, unknown> {
    return anthropicResponseConverter(anthropicBody, model);
  }

  /** Convert an Anthropic SSE chunk to OpenAI SSE format. */
  convertAnthropicStreamChunk(chunk: string, model: string): string | null {
    return anthropicStreamChunkConverter(chunk, model);
  }

  /** Create a stateful Anthropic stream transformer that tracks usage across events. */
  createAnthropicStreamTransformer(
    model: string,
    onThinkingBlocks?: ThinkingBlocksCallback,
  ): (chunk: string) => string | null {
    return createAnthropicTransformer(model, onThinkingBlocks);
  }

  /** Collect a ChatGPT SSE stream into a non-streaming OpenAI response. */
  collectChatGptSseResponse(sseText: string, model: string): Record<string, unknown> {
    return chatGptSseCollector(sseText, model);
  }
}
