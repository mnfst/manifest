import { computeTokenCost } from '../../common/utils/cost-calculator';
import type { PricingEntry } from '../../model-prices/model-pricing-cache.service';
import { parseUsageObject, type StreamUsage } from './stream-writer';

/**
 * Context needed to price a single proxy response the same way the dashboard
 * records `cost_usd` on agent messages (LiteLLM / OpenRouter-style gateways).
 */
export interface ResponseCostContext {
  model: string;
  authType?: string | null;
  pricing?: PricingEntry;
  perRequestCostUsd?: number | null;
}

export interface ResponseCostState {
  promptTokens?: number;
  completionTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  reportedCostUsd?: number;
}

export function createResponseCostState(): ResponseCostState {
  return { completionTokens: 0 };
}

/**
 * Resolve USD cost for a parsed usage block. Returns null when pricing is
 * unavailable (same semantics as computeTokenCost / dashboard).
 */
export function resolveResponseCostUsd(
  usage: StreamUsage,
  ctx: ResponseCostContext,
): number | null {
  return computeTokenCost({
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cacheReadTokens: usage.cache_read_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_tokens ?? 0,
    model: ctx.model,
    pricing: ctx.pricing,
    isSubscription: ctx.authType === 'subscription',
    perRequestCostUsd: ctx.perRequestCostUsd,
    reportedCostUsd: usage.reported_cost_usd,
  });
}

/**
 * Attach gateway cost onto an OpenAI/Anthropic usage object as `usage.cost`.
 * Matches LiteLLM (`include_cost_in_streaming_usage`) and OpenRouter.
 *
 * Prefers Manifest-computed cost so clients stay consistent with dashboard
 * pricing. When cost cannot be resolved, leaves any upstream `cost` intact.
 */
export function attachCostToUsageObject(usage: unknown, costUsd: number | null): void {
  if (
    costUsd == null ||
    !Number.isFinite(costUsd) ||
    costUsd < 0 ||
    !usage ||
    typeof usage !== 'object' ||
    Array.isArray(usage)
  ) {
    return;
  }
  (usage as Record<string, unknown>).cost = costUsd;
}

function mergeUsage(usageValue: unknown, state: ResponseCostState): StreamUsage | null {
  if (!usageValue || typeof usageValue !== 'object' || Array.isArray(usageValue)) {
    return null;
  }

  const parsed = parseUsageObject(usageValue);
  if (parsed) {
    state.promptTokens = parsed.prompt_tokens;
    state.completionTokens = parsed.completion_tokens;
    state.cacheReadTokens = parsed.cache_read_tokens;
    state.cacheCreationTokens = parsed.cache_creation_tokens;
    state.reportedCostUsd = parsed.reported_cost_usd;
  } else {
    const usage = usageValue as Record<string, unknown>;
    const completionTokens =
      typeof usage.completion_tokens === 'number'
        ? usage.completion_tokens
        : typeof usage.output_tokens === 'number'
          ? usage.output_tokens
          : undefined;
    if (completionTokens === undefined) return null;
    state.completionTokens = completionTokens;
  }

  if (state.promptTokens === undefined) return null;
  return {
    prompt_tokens: state.promptTokens,
    completion_tokens: state.completionTokens,
    cache_read_tokens: state.cacheReadTokens,
    cache_creation_tokens: state.cacheCreationTokens,
    ...(state.reportedCostUsd !== undefined ? { reported_cost_usd: state.reportedCostUsd } : {}),
  };
}

/**
 * Inject cost into every usage object nested under a non-stream response body:
 * - Chat Completions / Messages: top-level `usage`
 * - Responses API: top-level `usage` and/or nested `response.usage`
 * - Anthropic stream start: nested `message.usage` is accumulated so the
 *   output-only terminal `message_delta.usage` can receive the full cost
 */
export function attachCostToResponseBody(
  body: unknown,
  ctx: ResponseCostContext,
  state: ResponseCostState = createResponseCostState(),
): StreamUsage | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;

  let lastUsage: StreamUsage | null = null;

  const tryAttach = (usageValue: unknown, attach = true): void => {
    const merged = mergeUsage(usageValue, state);
    if (!merged) return;
    lastUsage = merged;
    if (attach) {
      attachCostToUsageObject(usageValue, resolveResponseCostUsd(merged, ctx));
    }
  };

  tryAttach(record.usage);

  const response = record.response;
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    tryAttach((response as Record<string, unknown>).usage);
  }

  const message = record.message;
  if (message && typeof message === 'object' && !Array.isArray(message)) {
    // `message_start.message.usage` contains the input side of Anthropic
    // streaming usage. Accumulate it, but stamp the total on message_delta.
    tryAttach((message as Record<string, unknown>).usage, false);
  }

  return lastUsage;
}

function serializeSseEvent(prefixLines: string[], payload: string): string {
  return [...prefixLines, ...payload.split('\n').map((line) => `data: ${line}`)].join('\n');
}

/**
 * Rewrite a single parsed SSE event (the shape produced by createSsePayloadParser)
 * so any JSON `usage` block includes Manifest cost. Always restores valid
 * `data:` framing, including for events without usage.
 */
export function injectCostIntoSseEvent(
  eventText: string,
  ctx: ResponseCostContext,
  state: ResponseCostState = createResponseCostState(),
): { text: string; usage: StreamUsage | null } {
  const lines = eventText.split('\n');
  const dataLines: string[] = [];
  const prefixLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('data:')) {
      dataLines.push(trimmed.slice(5).trim());
    } else if (
      trimmed.startsWith('event:') ||
      trimmed.startsWith('id:') ||
      trimmed.startsWith('retry:') ||
      trimmed.startsWith(':')
    ) {
      prefixLines.push(line);
    } else {
      // Some parsers pass bare JSON without a data: prefix.
      dataLines.push(trimmed);
    }
  }

  if (dataLines.length === 0) {
    return { text: prefixLines.join('\n'), usage: null };
  }

  const payload = dataLines.join('\n');
  if (!payload || payload === '[DONE]') {
    return { text: serializeSseEvent(prefixLines, payload), usage: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { text: serializeSseEvent(prefixLines, payload), usage: null };
  }

  const usage = attachCostToResponseBody(parsed, ctx, state);
  if (!usage) {
    return { text: serializeSseEvent(prefixLines, payload), usage: null };
  }

  return { text: serializeSseEvent(prefixLines, JSON.stringify(parsed)), usage };
}

/**
 * Rewrite complete outbound SSE produced by protocol transformers/finalizers.
 * Those callbacks may return several events in one string, so process each
 * event independently instead of trying to parse all data lines as one JSON
 * document.
 */
export function injectCostIntoSseChunk(
  chunk: string,
  ctx: ResponseCostContext,
  state: ResponseCostState = createResponseCostState(),
): { text: string; usage: StreamUsage | null } {
  const events = chunk.replace(/\r\n/g, '\n').split('\n\n');
  let lastUsage: StreamUsage | null = null;
  let text = '';

  for (const event of events) {
    if (!event.trim()) continue;
    const injected = injectCostIntoSseEvent(event, ctx, state);
    if (injected.usage) lastUsage = injected.usage;
    if (injected.text) text += `${injected.text}\n\n`;
  }

  return { text, usage: lastUsage };
}
