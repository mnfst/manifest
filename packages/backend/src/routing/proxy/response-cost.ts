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
  if (costUsd == null || !usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return;
  }
  (usage as Record<string, unknown>).cost = costUsd;
}

/**
 * Inject cost into every usage object nested under a non-stream response body:
 * - Chat Completions / Messages: top-level `usage`
 * - Responses API: top-level `usage` and/or nested `response.usage`
 */
export function attachCostToResponseBody(
  body: unknown,
  ctx: ResponseCostContext,
): StreamUsage | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;

  let lastUsage: StreamUsage | null = null;

  const tryAttach = (usageValue: unknown): void => {
    const parsed = parseUsageObject(usageValue);
    if (!parsed) return;
    lastUsage = parsed;
    attachCostToUsageObject(usageValue, resolveResponseCostUsd(parsed, ctx));
  };

  tryAttach(record.usage);

  const nested = record.response;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    tryAttach((nested as Record<string, unknown>).usage);
  }

  return lastUsage;
}

/**
 * Rewrite a single parsed SSE event (the shape produced by createSsePayloadParser)
 * so any JSON `usage` block includes Manifest cost. Preserves event:/id: lines
 * and multi-line data: framing.
 */
export function injectCostIntoSseEvent(
  eventText: string,
  ctx: ResponseCostContext,
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
    return { text: eventText, usage: null };
  }

  const payload = dataLines.join('\n');
  if (!payload || payload === '[DONE]') {
    return { text: eventText, usage: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { text: eventText, usage: null };
  }

  const usage = attachCostToResponseBody(parsed, ctx);
  if (!usage) {
    return { text: eventText, usage: null };
  }

  const rewritten = JSON.stringify(parsed);
  const out: string[] = [...prefixLines, `data: ${rewritten}`];
  return { text: out.join('\n'), usage };
}
