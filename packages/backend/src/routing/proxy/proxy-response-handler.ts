import { Logger } from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { RoutingMeta } from './proxy.service';
import { FailedFallback } from './proxy-fallback.service';
import { ForwardResult } from './provider-client';
import { ProxyMessageRecorder } from './proxy-message-recorder';
import { ProviderClient } from './provider-client';
import {
  initSseHeaders,
  parseUsageObject,
  pipePassthrough,
  pipeStream,
  StreamUsage,
} from './stream-writer';
import { sanitizeProviderError } from './proxy-error-sanitizer';
import {
  collectResponsesSseResponse,
  createResponsesStreamTransformer,
  fromChatCompletionResponse,
} from './responses-adapter';
import {
  chatCompletionsResponseToMessages,
  createMessagesStreamTransformer,
} from './anthropic-messages-adapter';
import type { ProxyApiMode } from './proxy-types';
import type { ThoughtSignatureCache } from './thought-signature-cache';
import type { ThinkingBlockCache, ThinkingBlock } from './thinking-block-cache';
import type { ReasoningContentCache } from './reasoning-content-cache';
import type { ExtractedSignature } from './google-adapter';
import {
  extractThinkingBlocksFromMessagesResponse,
  type ExtractedThinkingBlocks,
} from './anthropic-adapter';
import { getOpenAiReasoningStreamFormat, supportsReasoningContent } from './reasoning-format';
import type { CallerAttribution } from './caller-classifier';
import {
  unwrapCodeAssistResponse,
  unwrapCodeAssistStreamPayload,
} from '../oauth/gemini/codeassist-envelope';

const logger = new Logger('ProxyResponseHandler');

function recordSafely(promise: Promise<unknown>, label: string): void {
  promise.catch((e) => logger.warn(`Failed to record ${label}: ${e}`));
}

export function buildMetaHeaders(meta: RoutingMeta): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Manifest-Tier': meta.tier,
    'X-Manifest-Model': meta.model,
    'X-Manifest-Provider': meta.provider,
    'X-Manifest-Confidence': String(meta.confidence),
    'X-Manifest-Reason': meta.reason,
    'X-Manifest-Output-Modality': meta.output_modality ?? 'text',
    'X-Manifest-Response-Mode': meta.response_mode ?? 'buffered',
  };
  if (meta.specificity_category) {
    headers['X-Manifest-Specificity'] = meta.specificity_category;
  }
  if (meta.fallbackFromModel) {
    headers['X-Manifest-Fallback-From'] = meta.fallbackFromModel;
    headers['X-Manifest-Fallback-Index'] = String(meta.fallbackIndex ?? 0);
  }
  return headers;
}

function setHeaders(res: ExpressResponse, headers: Record<string, string>): void {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
}

export async function handleProviderError(
  res: ExpressResponse,
  ctx: IngestionContext,
  meta: RoutingMeta,
  metaHeaders: Record<string, string>,
  errorStatus: number,
  errorBody: string,
  failedFallbacks: FailedFallback[] | undefined,
  recorder: ProxyMessageRecorder,
  traceId?: string,
  callerAttribution?: CallerAttribution | null,
  requestHeaders?: Record<string, string> | null,
): Promise<void> {
  if (failedFallbacks && failedFallbacks.length > 0 && !meta.fallbackFromModel) {
    await handleFallbackExhausted(
      res,
      ctx,
      meta,
      metaHeaders,
      errorStatus,
      errorBody,
      failedFallbacks,
      recorder,
      traceId,
      callerAttribution,
      requestHeaders,
    );
    return;
  }

  recordSafely(
    recorder.recordProviderError(ctx, errorStatus, errorBody, {
      model: meta.model,
      provider: meta.provider,
      tier: meta.tier,
      traceId,
      fallbackFromModel: meta.fallbackFromModel,
      fallbackIndex: meta.fallbackIndex,
      authType: meta.auth_type,
      reason: meta.reason,
      specificityCategory: meta.specificity_category,
      providerKeyLabel: meta.provider_key_label,
      tenantProviderId: meta.tenantProviderId,
      callerAttribution,
      requestHeaders,
      requestParams: meta.request_params,
      headerTierId: meta.header_tier_id,
      headerTierName: meta.header_tier_name,
      headerTierColor: meta.header_tier_color,
    }),
    'provider error',
  );

  logger.warn(
    `Upstream error ${errorStatus}: provider=${meta.provider} model=${meta.model} tier=${meta.tier} body=${errorBody.slice(0, 500)}`,
  );
  res.status(errorStatus);
  setHeaders(res, metaHeaders);
  res.json({
    error: {
      message: sanitizeProviderError(errorStatus, errorBody, process.env.NODE_ENV),
      type: 'upstream_error',
      status: errorStatus,
    },
  });
}

function handleFallbackExhausted(
  res: ExpressResponse,
  ctx: IngestionContext,
  meta: RoutingMeta,
  metaHeaders: Record<string, string>,
  errorStatus: number,
  errorBody: string,
  failedFallbacks: FailedFallback[],
  recorder: ProxyMessageRecorder,
  traceId?: string,
  callerAttribution?: CallerAttribution | null,
  requestHeaders?: Record<string, string> | null,
): void {
  const baseTime = Date.now();
  recordSafely(
    recorder.recordFailedFallbacks(ctx, meta.tier, meta.model, failedFallbacks, {
      traceId,
      baseTimeMs: baseTime,
      markHandled: true,
      lastAsError: true,
      authType: meta.auth_type,
      reason: meta.reason,
      callerAttribution,
      requestHeaders,
      requestParams: meta.request_params,
      headerTierId: meta.header_tier_id,
      headerTierName: meta.header_tier_name,
      headerTierColor: meta.header_tier_color,
    }),
    'fallback errors',
  );

  const primaryTs = new Date(baseTime + (failedFallbacks.length + 1) * 100).toISOString();
  recordSafely(
    recorder.recordPrimaryFailure(
      ctx,
      meta.tier,
      meta.model,
      errorBody,
      primaryTs,
      meta.auth_type,
      {
        provider: meta.provider,
        reason: meta.reason,
        // Exhausted chain: primary connection (meta.tenantProviderId holds it here).
        tenantProviderId: meta.tenantProviderId,
        callerAttribution,
        requestHeaders,
        requestParams: meta.request_params,
        headerTierId: meta.header_tier_id,
        headerTierName: meta.header_tier_name,
        headerTierColor: meta.header_tier_color,
      },
    ),
    'primary failure',
  );

  logger.warn(`Fallback chain exhausted: ${errorBody.slice(0, 200)}`);
  res.status(errorStatus);
  setHeaders(res, metaHeaders);
  res.setHeader('X-Manifest-Fallback-Exhausted', 'true');
  res.json({
    error: {
      message: sanitizeProviderError(errorStatus, errorBody, process.env.NODE_ENV),
      type: 'fallback_exhausted',
      status: errorStatus,
      primary_model: meta.model,
      primary_provider: meta.provider,
      attempted_fallbacks: failedFallbacks.map((f) => ({
        model: f.model,
        provider: f.provider,
        status: f.status,
      })),
    },
  });
}

export function recordFallbackFailures(
  ctx: IngestionContext,
  meta: RoutingMeta,
  failedFallbacks: FailedFallback[] | undefined,
  recorder: ProxyMessageRecorder,
  callerAttribution?: CallerAttribution | null,
  requestHeaders?: Record<string, string> | null,
): string | undefined {
  if (!meta.fallbackFromModel) return undefined;

  const fallbackBaseTime = Date.now();
  const failures = failedFallbacks ?? [];

  // The primary's auth_type is preserved separately on a fallback-success flow
  // (see RoutingMeta.primaryAuthType / #1173). Older meta shapes only carry
  // `auth_type`, so fall back to it when primaryAuthType is absent.
  const primaryAuthType = meta.primaryAuthType ?? meta.auth_type;
  recordSafely(
    recorder.recordPrimaryFailure(
      ctx,
      meta.tier,
      meta.fallbackFromModel,
      meta.primaryErrorBody ?? `Provider returned HTTP ${meta.primaryErrorStatus ?? 500}`,
      new Date(fallbackBaseTime).toISOString(),
      primaryAuthType,
      {
        // Use the primary provider explicitly — meta.provider holds the
        // succeeding fallback's provider in this flow, not the primary's.
        provider: meta.primaryProvider,
        reason: meta.reason,
        // meta.tenantProviderId holds the winning fallback here; the primary's id
        // is preserved separately (mirrors primaryProvider / primaryAuthType).
        // Compare against undefined, not ??, so an explicit null primary
        // connection (e.g. Ollama) stays null rather than being misattributed
        // to the fallback's connection.
        tenantProviderId:
          meta.primaryTenantProviderId === undefined
            ? meta.tenantProviderId
            : meta.primaryTenantProviderId,
        callerAttribution,
        requestHeaders,
        requestParams: meta.request_params,
        headerTierId: meta.header_tier_id,
        headerTierName: meta.header_tier_name,
        headerTierColor: meta.header_tier_color,
      },
    ),
    'primary failure',
  );

  if (failures.length > 0) {
    recordSafely(
      recorder.recordFailedFallbacks(ctx, meta.tier, meta.fallbackFromModel, failures, {
        baseTimeMs: fallbackBaseTime,
        markHandled: true,
        authType: primaryAuthType,
        reason: meta.reason,
        callerAttribution,
        requestHeaders,
        requestParams: meta.request_params,
        headerTierId: meta.header_tier_id,
        headerTierName: meta.header_tier_name,
        headerTierColor: meta.header_tier_color,
      }),
      'fallback errors',
    );
  }

  return new Date(fallbackBaseTime + (failures.length + 1) * 100).toISOString();
}

export async function handleStreamResponse(
  res: ExpressResponse,
  forward: ForwardResult,
  meta: RoutingMeta,
  metaHeaders: Record<string, string>,
  providerClient: ProviderClient,
  signatureCache?: ThoughtSignatureCache,
  sessionKey?: string,
  thinkingCache?: ThinkingBlockCache,
  apiMode: ProxyApiMode = 'chat_completions',
  reasoningCache?: ReasoningContentCache,
): Promise<StreamUsage | null> {
  initSseHeaders(res, metaHeaders, 200);

  const onClient = undefined;

  const messagesTransformer =
    apiMode === 'messages' ? createMessagesStreamTransformer(meta.model) : null;
  // Responses inbound over a Chat Completions upstream needs a stateful
  // converter so the message-item lifecycle events frame the text deltas
  // (issue #2064). It shares the messages transformer's {transform, finalize}
  // shape, and likewise owns stream termination via `finalize` (which emits
  // the trailing `[DONE]` that pipeStream then skips).
  const responsesTransformer =
    apiMode === 'responses' ? createResponsesStreamTransformer(meta.model) : null;
  const streamTransformer = messagesTransformer ?? responsesTransformer;
  const finalize = streamTransformer ? () => streamTransformer.finalize() : undefined;
  const toClientChunk = streamTransformer
    ? (chunk: string) => streamTransformer.transform(chunk)
    : (chunk: string) => chunk;

  if (apiMode === 'responses' && forward.isResponses) {
    return pipeStream(forward.response.body!, res, undefined, undefined, onClient);
  }

  if (forward.isGoogle) {
    return pipeStream(
      forward.response.body!,
      res,
      (chunk) => {
        const innerChunk = forward.isCodeAssist ? unwrapCodeAssistStreamPayload(chunk) : chunk;
        const { chunk: out, signatures } = providerClient.convertGoogleStreamChunk(
          innerChunk,
          meta.model,
        );
        if (signatureCache && sessionKey) {
          for (const s of signatures) {
            signatureCache.store(sessionKey, s.toolCallId, s.signature);
          }
        }
        return out ? toClientChunk(out) : null;
      },
      finalize,
      onClient,
    );
  }
  if (forward.isAnthropic) {
    const onThinkingBlocks =
      thinkingCache && sessionKey
        ? (firstToolUseId: string, blocks: ThinkingBlock[]) => {
            thinkingCache.store(sessionKey, firstToolUseId, blocks);
          }
        : undefined;
    const anthropicTransformer = providerClient.createAnthropicStreamTransformer(
      meta.model,
      onThinkingBlocks,
    );
    // Anthropic Messages inbound + Anthropic upstream: forward the upstream
    // SSE bytes byte-for-byte so Anthropic SSE framing (`event:` headers,
    // multi-line `data:` payloads, blank-line separators) reaches the
    // client intact, and Anthropic-only content blocks (`server_tool_use`,
    // `web_search_tool_result`, etc.) are not lost to translation. The
    // transformer runs purely as a tap — thinking-block cache via callback
    // and OpenAI-shape usage parsed off its return value by pipePassthrough.
    if (apiMode === 'messages') {
      return pipePassthrough(forward.response.body!, res, anthropicTransformer, onClient);
    }
    return pipeStream(
      forward.response.body!,
      res,
      (chunk) => {
        const out = anthropicTransformer(chunk);
        return out ? toClientChunk(out) : null;
      },
      finalize,
      onClient,
    );
  }
  if (forward.isChatGpt) {
    return pipeStream(
      forward.response.body!,
      res,
      (chunk) => {
        const out = providerClient.convertChatGptStreamChunk(chunk, meta.model);
        if (!messagesTransformer) return out;
        return out ? toClientChunk(out) : null;
      },
      finalize,
      onClient,
    );
  }
  const reasoningStreamFormat = getOpenAiReasoningStreamFormat(meta.provider, meta.model);
  if (reasoningStreamFormat) {
    const onReasoningContent =
      reasoningCache && sessionKey
        ? (firstToolCallId: string, content: string) => {
            reasoningCache.store(sessionKey, firstToolCallId, content);
          }
        : undefined;
    const transformer = providerClient.createReasoningContentStreamTransformer(
      onReasoningContent,
      reasoningStreamFormat,
    );
    return pipeStream(
      forward.response.body!,
      res,
      (chunk) => {
        const out = transformer(chunk);
        return out ? toClientChunk(out) : null;
      },
      finalize,
      onClient,
    );
  }
  if (apiMode === 'responses' || apiMode === 'messages') {
    return pipeStream(forward.response.body!, res, toClientChunk, finalize, onClient);
  }
  return pipeStream(forward.response.body!, res, undefined, undefined, onClient);
}

function cacheReasoningContent(
  responseBody: unknown,
  cache: ReasoningContentCache | undefined,
  sessionKey: string | undefined,
): void {
  if (!cache || !sessionKey) return;
  const body = responseBody as Record<string, unknown> | undefined;
  const choices = body?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return;
  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== 'object' || Array.isArray(firstChoice)) return;
  const message = (firstChoice as Record<string, unknown>).message as
    | Record<string, unknown>
    | undefined;
  if (!message) return;
  const reasoningContent = message.reasoning_content;
  if (typeof reasoningContent !== 'string' || !reasoningContent) return;
  const toolCalls = message.tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return;
  const firstToolCall = toolCalls[0];
  const firstToolCallId =
    firstToolCall && typeof firstToolCall === 'object' && !Array.isArray(firstToolCall)
      ? (firstToolCall as Record<string, unknown>).id
      : undefined;
  if (typeof firstToolCallId !== 'string' || !firstToolCallId) return;
  cache.store(sessionKey, firstToolCallId, reasoningContent);
}

export async function handleNonStreamResponse(
  res: ExpressResponse,
  forward: ForwardResult,
  meta: RoutingMeta,
  metaHeaders: Record<string, string>,
  providerClient: ProviderClient,
  signatureCache?: ThoughtSignatureCache,
  sessionKey?: string,
  thinkingCache?: ThinkingBlockCache,
  apiMode: ProxyApiMode = 'chat_completions',
  reasoningCache?: ReasoningContentCache,
): Promise<StreamUsage | null> {
  let responseBody: unknown;

  if (apiMode === 'responses' && forward.isResponses) {
    responseBody = await readNativeResponsesBody(forward.response);
  } else if (forward.isGoogle) {
    const rawData = (await forward.response.json()) as Record<string, unknown>;
    const googleData = forward.isCodeAssist ? unwrapCodeAssistResponse(rawData) : rawData;
    responseBody = providerClient.convertGoogleResponse(googleData, meta.model);
    const sigs = (responseBody as Record<string, unknown>)?._extractedSignatures as
      | ExtractedSignature[]
      | undefined;
    if (sigs && signatureCache && sessionKey) {
      for (const s of sigs) signatureCache.store(sessionKey, s.toolCallId, s.signature);
    }
    // Always strip the internal side-channel — it must never reach the client,
    // even if the cache wasn't provided for this request.
    delete (responseBody as Record<string, unknown>)._extractedSignatures;
  } else if (apiMode === 'messages' && forward.isAnthropic) {
    // Anthropic Messages inbound + Anthropic upstream: pass the response
    // body through unchanged so Anthropic-only content blocks
    // (`server_tool_use`, `web_search_tool_result`, etc.) survive. The
    // OpenAI-shaped converter only knows `text` / `thinking` / `tool_use`
    // and would silently drop the rest.
    const anthropicData = (await forward.response.json()) as Record<string, unknown>;
    const extracted = extractThinkingBlocksFromMessagesResponse(anthropicData);
    if (extracted && thinkingCache && sessionKey) {
      thinkingCache.store(sessionKey, extracted.firstToolUseId, extracted.blocks);
    }
    responseBody = anthropicData;
  } else if (forward.isAnthropic) {
    const anthropicData = (await forward.response.json()) as Record<string, unknown>;
    responseBody = providerClient.convertAnthropicResponse(anthropicData, meta.model);
    const extracted = (responseBody as Record<string, unknown>)?._extractedThinkingBlocks as
      | ExtractedThinkingBlocks
      | undefined;
    if (extracted && thinkingCache && sessionKey) {
      thinkingCache.store(sessionKey, extracted.firstToolUseId, extracted.blocks);
    }
    delete (responseBody as Record<string, unknown>)._extractedThinkingBlocks;
  } else if (forward.isChatGpt) {
    // The Codex Responses API always returns SSE even when stream: false.
    // Consume the SSE text and build a non-streaming response.
    const sseText = await forward.response.text();
    responseBody = providerClient.collectChatGptSseResponse(sseText, meta.model);
  } else {
    responseBody = await forward.response.json();
    if (supportsReasoningContent(meta.provider, meta.model)) {
      cacheReasoningContent(responseBody, reasoningCache, sessionKey);
    }
  }

  if (apiMode === 'responses' && !forward.isResponses) {
    responseBody = fromChatCompletionResponse(responseBody as Record<string, unknown>, meta.model);
  } else if (apiMode === 'messages' && !forward.isAnthropic) {
    // Anthropic upstreams already returned a Messages-shaped body via the
    // passthrough branch above. Skip the round-trip translation that would
    // strip Anthropic-only content blocks.
    responseBody = chatCompletionsResponseToMessages(
      responseBody as Record<string, unknown>,
      meta.model,
    );
  }

  const body = responseBody as Record<string, unknown> | undefined;
  const streamUsage = parseUsageObject(body?.usage);

  res.status(200);
  setHeaders(res, metaHeaders);
  res.json(responseBody);
  return streamUsage;
}

async function readNativeResponsesBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const trimmed = text.trimStart();

  if (
    contentType.includes('text/event-stream') ||
    trimmed.startsWith('event:') ||
    trimmed.startsWith('data:')
  ) {
    return collectResponsesSseResponse(text);
  }

  return JSON.parse(text);
}

export function recordSuccess(
  ctx: IngestionContext,
  meta: RoutingMeta,
  streamUsage: StreamUsage | null,
  fallbackSuccessTs: string | undefined,
  recorder: ProxyMessageRecorder,
  traceId?: string,
  sessionKey?: string,
  startTime?: number,
  callerAttribution?: CallerAttribution | null,
  requestHeaders?: Record<string, string> | null,
): void {
  if (meta.fallbackFromModel && fallbackSuccessTs) {
    recordSafely(
      recorder.recordFallbackSuccess(ctx, meta.model, meta.tier, {
        traceId,
        provider: meta.provider,
        fallbackFromModel: meta.fallbackFromModel,
        fallbackIndex: meta.fallbackIndex ?? 0,
        timestamp: fallbackSuccessTs,
        authType: meta.auth_type,
        reason: meta.reason,
        providerKeyLabel: meta.provider_key_label,
        tenantProviderId: meta.tenantProviderId,
        usage: streamUsage ?? undefined,
        callerAttribution,
        requestHeaders,
        requestParams: meta.request_params,
        headerTierId: meta.header_tier_id,
        headerTierName: meta.header_tier_name,
        headerTierColor: meta.header_tier_color,
      }),
      'fallback success',
    );
  } else {
    const usage = streamUsage ?? { prompt_tokens: 0, completion_tokens: 0 };
    const durationMs = startTime ? Date.now() - startTime : undefined;
    recordSafely(
      recorder.recordSuccessMessage(ctx, meta.model, meta.tier, meta.reason, usage, {
        traceId,
        provider: meta.provider,
        authType: meta.auth_type,
        sessionKey,
        durationMs,
        specificityCategory: meta.specificity_category,
        providerKeyLabel: meta.provider_key_label,
        tenantProviderId: meta.tenantProviderId,
        callerAttribution,
        requestHeaders,
        requestParams: meta.request_params,
        headerTierId: meta.header_tier_id,
        headerTierName: meta.header_tier_name,
        headerTierColor: meta.header_tier_color,
      }),
      'success message',
    );
  }
}
