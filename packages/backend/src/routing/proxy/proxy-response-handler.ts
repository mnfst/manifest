import { Logger } from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { RoutingMeta, FailedFallback } from './proxy.service';
import { ForwardResult } from './provider-client';
import { ProxyMessageRecorder } from './proxy-message-recorder';
import { ProviderClient } from './provider-client';
import { initSseHeaders, pipeStream, StreamUsage } from './stream-writer';
import { sanitizeProviderError } from './proxy-error-sanitizer';

const logger = new Logger('ProxyResponseHandler');

export function buildMetaHeaders(meta: RoutingMeta): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Manifest-Tier': meta.tier,
    'X-Manifest-Model': meta.model,
    'X-Manifest-Provider': meta.provider,
    'X-Manifest-Confidence': String(meta.confidence),
    'X-Manifest-Reason': meta.reason,
  };
  if (meta.fallbackFromModel) {
    headers['X-Manifest-Fallback-From'] = meta.fallbackFromModel;
    headers['X-Manifest-Fallback-Index'] = String(meta.fallbackIndex ?? 0);
  }
  return headers;
}

function setHeaders(res: ExpressResponse, headers: Record<string, string>): void {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
}

/**
 * Handles non-OK provider responses: fallback-exhausted and single upstream errors.
 * Returns true if the response was handled (caller should return), false otherwise.
 */
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
    );
    return;
  }

  recorder
    .recordProviderError(ctx, errorStatus, errorBody, {
      model: meta.model,
      tier: meta.tier,
      traceId,
      fallbackFromModel: meta.fallbackFromModel,
      fallbackIndex: meta.fallbackIndex,
      authType: meta.auth_type,
    })
    .catch((e) => logger.warn(`Failed to record provider error: ${e}`));

  logger.warn(`Upstream error ${errorStatus}: ${errorBody.slice(0, 200)}`);
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
): void {
  const baseTime = Date.now();
  recorder
    .recordFailedFallbacks(ctx, meta.tier, meta.model, failedFallbacks, {
      traceId,
      baseTimeMs: baseTime,
      markHandled: true,
      lastAsError: true,
      authType: meta.auth_type,
    })
    .catch((e) => logger.warn(`Failed to record fallback errors: ${e}`));

  const primaryTs = new Date(baseTime + (failedFallbacks.length + 1) * 100).toISOString();
  recorder
    .recordPrimaryFailure(ctx, meta.tier, meta.model, errorBody, primaryTs, meta.auth_type)
    .catch((e) => logger.warn(`Failed to record primary failure: ${e}`));

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

/**
 * Records fallback failures when a fallback model ultimately succeeded.
 * Returns the timestamp to use for the fallback success record.
 */
export function recordFallbackFailures(
  ctx: IngestionContext,
  meta: RoutingMeta,
  failedFallbacks: FailedFallback[] | undefined,
  recorder: ProxyMessageRecorder,
): string | undefined {
  if (!meta.fallbackFromModel) return undefined;

  const fallbackBaseTime = Date.now();
  const failures = failedFallbacks ?? [];

  recorder
    .recordPrimaryFailure(
      ctx,
      meta.tier,
      meta.fallbackFromModel,
      meta.primaryErrorBody ?? `Provider returned HTTP ${meta.primaryErrorStatus ?? 500}`,
      new Date(fallbackBaseTime).toISOString(),
      meta.auth_type,
    )
    .catch((e) => logger.warn(`Failed to record primary failure: ${e}`));

  if (failures.length > 0) {
    recorder
      .recordFailedFallbacks(ctx, meta.tier, meta.fallbackFromModel, failures, {
        baseTimeMs: fallbackBaseTime,
        markHandled: true,
        authType: meta.auth_type,
      })
      .catch((e) => logger.warn(`Failed to record fallback errors: ${e}`));
  }

  return new Date(fallbackBaseTime + (failures.length + 1) * 100).toISOString();
}

/** Pipes a streaming response, applying adapter transforms as needed. */
export async function handleStreamResponse(
  res: ExpressResponse,
  forward: ForwardResult,
  meta: RoutingMeta,
  metaHeaders: Record<string, string>,
  providerClient: ProviderClient,
): Promise<StreamUsage | null> {
  initSseHeaders(res, metaHeaders);

  if (forward.isGoogle) {
    return pipeStream(forward.response.body!, res, (chunk) =>
      providerClient.convertGoogleStreamChunk(chunk, meta.model),
    );
  }
  if (forward.isAnthropic) {
    return pipeStream(
      forward.response.body!,
      res,
      providerClient.createAnthropicStreamTransformer(meta.model),
    );
  }
  if (forward.isChatGpt) {
    return pipeStream(forward.response.body!, res, (chunk) =>
      providerClient.convertChatGptStreamChunk(chunk, meta.model),
    );
  }
  return pipeStream(forward.response.body!, res);
}

/** Reads and converts a non-streaming response, extracting usage data. */
export async function handleNonStreamResponse(
  res: ExpressResponse,
  forward: ForwardResult,
  meta: RoutingMeta,
  metaHeaders: Record<string, string>,
  providerClient: ProviderClient,
): Promise<StreamUsage | null> {
  let responseBody: unknown;

  if (forward.isGoogle) {
    const googleData = (await forward.response.json()) as Record<string, unknown>;
    responseBody = providerClient.convertGoogleResponse(googleData, meta.model);
  } else if (forward.isAnthropic) {
    const anthropicData = (await forward.response.json()) as Record<string, unknown>;
    responseBody = providerClient.convertAnthropicResponse(anthropicData, meta.model);
  } else if (forward.isChatGpt) {
    const chatgptData = (await forward.response.json()) as Record<string, unknown>;
    responseBody = providerClient.convertChatGptResponse(chatgptData, meta.model);
  } else {
    responseBody = await forward.response.json();
  }

  const body = responseBody as Record<string, unknown> | undefined;
  const usage = body?.usage as Record<string, number> | undefined;
  let streamUsage: StreamUsage | null = null;
  if (usage && typeof usage.prompt_tokens === 'number') {
    streamUsage = {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens ?? 0,
      cache_read_tokens: usage.cache_read_tokens,
      cache_creation_tokens: usage.cache_creation_tokens,
    };
  }

  res.status(200);
  setHeaders(res, metaHeaders);
  res.json(responseBody);
  return streamUsage;
}

/** Records the success message or fallback success after response is sent. */
export function recordSuccess(
  ctx: IngestionContext,
  meta: RoutingMeta,
  streamUsage: StreamUsage | null,
  fallbackSuccessTs: string | undefined,
  recorder: ProxyMessageRecorder,
  traceId?: string,
  sessionKey?: string,
  startTime?: number,
): void {
  if (meta.fallbackFromModel && fallbackSuccessTs) {
    recorder
      .recordFallbackSuccess(ctx, meta.model, meta.tier, {
        traceId,
        fallbackFromModel: meta.fallbackFromModel,
        fallbackIndex: meta.fallbackIndex ?? 0,
        timestamp: fallbackSuccessTs,
        authType: meta.auth_type,
        usage: streamUsage ?? undefined,
      })
      .catch((e) => logger.warn(`Failed to record fallback success: ${e}`));
  } else {
    const usage = streamUsage ?? { prompt_tokens: 0, completion_tokens: 0 };
    const durationMs = startTime ? Date.now() - startTime : undefined;
    recorder
      .recordSuccessMessage(ctx, meta.model, meta.tier, meta.reason, usage, {
        traceId,
        authType: meta.auth_type,
        sessionKey,
        durationMs,
      })
      .catch((e) => logger.warn(`Failed to record success message: ${e}`));
  }
}
