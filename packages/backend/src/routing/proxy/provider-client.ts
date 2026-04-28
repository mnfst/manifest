import { Injectable, Logger } from '@nestjs/common';
import { OPENAI_RESPONSES_ONLY_RE, stripVendorPrefix } from '../../common/constants/openai-models';
import { PROVIDER_ENDPOINTS, ProviderEndpoint, resolveEndpointKey } from './provider-endpoints';
import { validatePublicUrl } from '../../common/utils/url-validation';
import { isSelfHosted } from '../../common/utils/detect-self-hosted';
import { resolveSubscriptionEndpointKey } from './provider-hooks';
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
} from './provider-client-converters';
import { ForwardOptions } from './proxy-types';
import { toNativeResponsesRequest } from './responses-adapter';

export interface ForwardResult {
  response: Response;
  /** True when we converted from Google format (needs SSE transform). */
  isGoogle: boolean;
  /** True when we converted from Anthropic format (needs SSE transform). */
  isAnthropic: boolean;
  /** True when we converted from ChatGPT Responses API format (needs SSE transform). */
  isChatGpt: boolean;
  /** True when the upstream already speaks the public Responses API format. */
  isResponses?: boolean;
}

const PROVIDER_TIMEOUT_MS = 180_000;

/**
 * Endpoint keys (OpenAI-compatible format) whose streaming responses support
 * `stream_options.include_usage`. Token usage is needed for DB logging and for
 * downstream clients (e.g. OpenClaw context management).
 */
const SUPPORTS_USAGE_STREAM_OPTIONS = new Set(['openai', 'openrouter', 'ollama', 'ollama-cloud']);

/**
 * Strip vendor prefix from model name (e.g. "anthropic/claude-sonnet-4" → "claude-sonnet-4").
 * Models synced from OpenRouter use vendor prefixes, but native APIs expect bare names.
 */
function stripModelPrefix(model: string, endpointKey: string): string {
  // OpenRouter accepts and expects vendor prefixes
  if (endpointKey === 'openrouter') return model;
  // Custom providers: CustomProviderService.rawModelName already stripped the
  // internal "custom:<id>/" prefix upstream. Stripping again would eat a
  // legitimate slash segment from the upstream model id
  // (e.g. "MiniMaxAI/MiniMax-2.7" or "accounts/fireworks/routers/...").
  if (endpointKey === 'custom') return model;
  return stripVendorPrefix(model);
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
    } = opts;

    const { endpoint, endpointKey } = this.resolveEndpoint(
      customEndpoint,
      provider,
      authType,
      model,
      opts.apiMode,
    );
    const isGoogle = endpoint.format === 'google';
    const isAnthropic = endpoint.format === 'anthropic';
    const isResponses = opts.apiMode === 'responses' && endpoint.format === 'chatgpt';
    const isChatGpt = endpoint.format === 'chatgpt' && !isResponses;

    const bareModel = stripModelPrefix(model, endpointKey);
    const { url, headers, requestBody } = this.buildRequest({
      endpoint,
      endpointKey,
      bareModel,
      model,
      apiKey,
      authType,
      body,
      chatBody: opts.chatBody,
      apiMode: opts.apiMode,
      stream,
      signatureLookup: opts.signatureLookup,
      thinkingLookup: opts.thinkingLookup,
    });

    const finalHeaders = extraHeaders ? { ...headers, ...extraHeaders } : headers;

    this.logger.debug(`Forwarding to ${endpointKey}: ${url.replace(/key=[^&]+/, 'key=***')}`);

    // SSRF defense in depth for user-supplied endpoint URLs (custom providers,
    // subscription resource URLs). validatePublicUrl was called when the URL
    // was stored, but DNS for the hostname may have rebound to a private or
    // cloud-metadata address since then. Re-resolve and re-check now.
    if (endpoint.requiresSsrfRevalidation) {
      try {
        await validatePublicUrl(url, { allowPrivate: isSelfHosted() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Refusing to forward to disallowed URL: ${message}`);
      }
    }

    return this.executeFetch(url, finalHeaders, requestBody, signal, {
      isGoogle,
      isAnthropic,
      isChatGpt,
      isResponses,
    });
  }

  private resolveEndpoint(
    customEndpoint: ProviderEndpoint | undefined,
    provider: string,
    authType: string | undefined,
    model: string,
    apiMode: ForwardOptions['apiMode'],
  ): { endpoint: ProviderEndpoint; endpointKey: string } {
    if (customEndpoint) {
      return { endpoint: customEndpoint, endpointKey: 'custom' };
    }
    let resolved = resolveEndpointKey(provider);
    if (!resolved) {
      throw new Error(`No endpoint configured for provider: ${provider}`);
    }
    if (authType === 'subscription') {
      const override = resolveSubscriptionEndpointKey(resolved);
      if (override) resolved = override;
    }
    if (apiMode === 'responses' && resolved === 'openai') {
      resolved = 'openai-responses';
    }
    // OpenAI rejects these models on /v1/chat/completions; forward to /v1/responses.
    if (resolved === 'openai' && OPENAI_RESPONSES_ONLY_RE.test(stripVendorPrefix(model))) {
      resolved = 'openai-responses';
    }
    if (resolved === 'opencode-go') {
      // OpenCode Go uses two different API formats depending on the model:
      // MiniMax models use Anthropic /v1/messages, all others use OpenAI /v1/chat/completions.
      if (stripVendorPrefix(model).toLowerCase().startsWith('minimax-')) {
        resolved = 'opencode-go-anthropic';
      }
    }
    return { endpoint: PROVIDER_ENDPOINTS[resolved], endpointKey: resolved };
  }

  private buildRequest(ctx: {
    endpoint: ProviderEndpoint;
    endpointKey: string;
    bareModel: string;
    model: string;
    apiKey: string;
    authType: string | undefined;
    body: Record<string, unknown>;
    chatBody?: Record<string, unknown>;
    apiMode?: ForwardOptions['apiMode'];
    stream: boolean;
    signatureLookup?: ForwardOptions['signatureLookup'];
    thinkingLookup?: ForwardOptions['thinkingLookup'];
  }): { url: string; headers: Record<string, string>; requestBody: Record<string, unknown> } {
    const { endpoint, endpointKey, bareModel, apiKey, authType, body, chatBody, stream } = ctx;
    const requestSource = ctx.apiMode === 'responses' ? (chatBody ?? body) : body;

    if (endpoint.format === 'google') {
      // Google Gemini API requires the key as a URL parameter (not a header).
      // It may be visible to intermediate proxies between Manifest and Google's API.
      let url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}?key=${apiKey}`;
      if (stream) url += '&alt=sse';
      return {
        url,
        headers: endpoint.buildHeaders(apiKey, authType),
        requestBody: toGoogleRequest(requestSource, bareModel, ctx.signatureLookup),
      };
    }

    if (endpoint.format === 'anthropic') {
      const isSubscription = authType === 'subscription';
      const requestBody = toAnthropicRequest(requestSource, bareModel, {
        injectCacheControl: !isSubscription,
        injectSubscriptionIdentity: isSubscription,
        thinkingLookup: ctx.thinkingLookup,
      });
      requestBody.model = bareModel;
      if (stream) requestBody.stream = true;
      return {
        url: `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}`,
        headers: endpoint.buildHeaders(apiKey, authType),
        requestBody,
      };
    }

    if (endpoint.format === 'chatgpt') {
      return {
        url: `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}`,
        headers: endpoint.buildHeaders(apiKey, authType),
        requestBody:
          ctx.apiMode === 'responses'
            ? // ChatGPT subscription tokens hit the Codex Responses backend, which
              // requires instruction text, list-shaped input, and upstream SSE even
              // when Manifest returns a non-streaming JSON response to the caller.
              toNativeResponsesRequest(body, bareModel, {
                defaultInstructions: endpointKey === 'openai-subscription',
                inputList: endpointKey === 'openai-subscription',
                forceStream: endpointKey === 'openai-subscription',
              })
            : toResponsesRequest(body, bareModel),
      };
    }

    // OpenAI-compatible path (default)
    const sanitized = sanitizeOpenAiBody(requestSource, endpointKey, ctx.model);
    if (stream && SUPPORTS_USAGE_STREAM_OPTIONS.has(endpointKey)) {
      const existing =
        typeof sanitized.stream_options === 'object' && sanitized.stream_options !== null
          ? (sanitized.stream_options as Record<string, unknown>)
          : {};
      sanitized.stream_options = { ...existing, include_usage: true };
    }
    const requestBody = { ...sanitized, model: bareModel, stream };
    if (endpointKey === 'openrouter' && ctx.model.startsWith('anthropic/')) {
      injectOpenRouterCacheControl(requestBody);
    }
    return {
      url: `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}`,
      headers: endpoint.buildHeaders(apiKey, authType),
      requestBody,
    };
  }

  private async executeFetch(
    url: string,
    headers: Record<string, string>,
    requestBody: Record<string, unknown>,
    signal: AbortSignal | undefined,
    formatFlags: {
      isGoogle: boolean;
      isAnthropic: boolean;
      isChatGpt: boolean;
      isResponses?: boolean;
    },
  ): Promise<ForwardResult> {
    const timeoutSignal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
    const fetchSignal = signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: fetchSignal,
        // Block redirect-based SSRF escalation: a hostile upstream could 302
        // to a private/metadata endpoint after our pre-fetch validation.
        redirect: 'error',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message.replace(/key=[^&\s]+/gi, 'key=***'));
    }

    return { response, ...formatFlags };
  }

  /**
   * Response/stream converters are assigned as properties (not methods) so they
   * delegate straight through to `provider-client-converters` without an extra
   * wrapper frame, while remaining mockable via DI in tests.
   */
  readonly convertChatGptResponse = chatGptResponseConverter;
  readonly convertChatGptStreamChunk = chatGptStreamChunkConverter;
  readonly convertGoogleResponse = googleResponseConverter;
  readonly convertGoogleStreamChunk = googleStreamChunkConverter;
  readonly convertAnthropicResponse = anthropicResponseConverter;
  readonly convertAnthropicStreamChunk = anthropicStreamChunkConverter;
  readonly createAnthropicStreamTransformer = createAnthropicTransformer;
  readonly collectChatGptSseResponse = chatGptSseCollector;
}
