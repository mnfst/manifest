import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface OpencodeGoCatalogEntry {
  /** Bare model ID as listed in the docs (e.g. "glm-5.1"). */
  id: string;
  /** Human-readable display name from the docs (e.g. "GLM-5.1"). */
  displayName: string;
  /** Which upstream API format the model expects. */
  format: 'openai' | 'anthropic';
  /**
   * Cost in USD attributed to one request, derived from the docs Usage Limits
   * table: `OPENCODE_GO_BUDGET_5H_USD / requestsPer5h`. `null` when the docs
   * table did not include a row for this model.
   */
  costPerRequestUsd: number | null;
}

const CATALOG_URL =
  'https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/web/src/content/docs/go.mdx';
const CACHE_TTL_MS = 60 * 60 * 1000;
// After a fetch failure we reuse the last-known-good list for a shorter window
// so a sustained outage does not turn into a per-call retry storm.
const ERROR_BACKOFF_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Published 5-hour quota in USD for an OpenCode Go subscription. The docs
 * express per-model usage as "requests per 5 hour", so dividing that dollar
 * value by the request count gives the dollar cost the docs attribute to a
 * single request.
 *
 * Source: https://opencode.ai/docs/go/#usage-limits
 */
export const OPENCODE_GO_BUDGET_5H_USD = 12;

/**
 * Fetches the OpenCode Go model list from the public docs source.
 * OpenCode Go has no /v1/models endpoint, so the canonical list lives
 * in the markdown docs file the website renders from. We parse the
 * Endpoints table (for model IDs + API format) and the Usage Limits
 * table (for per-request cost) and cache the merged result in memory.
 */
@Injectable()
export class OpencodeGoCatalogService implements OnModuleInit {
  private readonly logger = new Logger(OpencodeGoCatalogService.name);
  private cache: { entries: OpencodeGoCatalogEntry[]; expiresAt: number } | null = null;
  private lastGood: OpencodeGoCatalogEntry[] | null = null;
  private costByModelId = new Map<string, number>();

  /**
   * Warm the catalog in the background at boot so the per-request cost index
   * is populated before the proxy hot path runs. Discovery typically warms it
   * on its own, but a cold process restart can record OpenCode Go calls
   * against an empty index — the recorder treats a missing entry as $0,
   * which is the original bug. Fire-and-forget; failures fall through to the
   * existing fetch-on-demand path in `list()`.
   */
  onModuleInit(): void {
    void this.list().catch(() => {
      // `list()` already logs failures and arms the error-backoff window.
    });
  }

  async list(): Promise<OpencodeGoCatalogEntry[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.entries;
    }

    try {
      const response = await fetch(CATALOG_URL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`OpenCode Go catalog fetch returned ${response.status}`);
        return this.cacheFallback(now);
      }
      const mdx = await response.text();
      const entries = this.parse(mdx);
      if (entries.length === 0) {
        this.logger.warn('OpenCode Go catalog parsed zero entries — docs format may have changed');
        return this.cacheFallback(now);
      }
      this.cache = { entries, expiresAt: now + CACHE_TTL_MS };
      this.lastGood = entries;
      this.rebuildCostIndex(entries);
      this.logger.log(`OpenCode Go catalog loaded: ${entries.length} models`);
      return entries;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OpenCode Go catalog fetch failed: ${message}`);
      return this.cacheFallback(now);
    }
  }

  /**
   * Sync lookup for the per-request cost of an OpenCode Go model. Returns
   * `null` when the catalog has not been loaded yet, when the docs did not
   * publish a limit for the model, or when the model is unknown. Accepts
   * either a bare model ID (`glm-5.1`) or the prefixed form
   * (`opencode-go/glm-5.1`) — callers don't need to strip the prefix.
   */
  getCostPerRequest(modelId: string | null | undefined): number | null {
    if (!modelId) return null;
    const bare = modelId.startsWith('opencode-go/')
      ? modelId.slice('opencode-go/'.length)
      : modelId;
    return this.costByModelId.get(bare) ?? null;
  }

  /**
   * Set a short error-backoff cache so repeated calls during an outage do not
   * hammer the network, then return the last-known-good list (or []).
   */
  private cacheFallback(now: number): OpencodeGoCatalogEntry[] {
    const entries = this.lastGood ?? [];
    this.cache = { entries, expiresAt: now + ERROR_BACKOFF_MS };
    return entries;
  }

  /** Parse the Endpoints and Usage Limits tables out of the go.mdx source. */
  parse(mdx: string): OpencodeGoCatalogEntry[] {
    const costByName = this.parseLimits(mdx);
    const rowRe =
      /\|\s*([A-Za-z][^|]*?)\s*\|\s*([a-z][a-z0-9.-]*)\s*\|\s*`?https:\/\/opencode\.ai\/zen\/go\/v1\/(chat\/completions|messages)`?\s*\|/g;
    const entries: OpencodeGoCatalogEntry[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = rowRe.exec(mdx)) !== null) {
      const [, rawName, modelId, endpointSuffix] = match;
      const displayName = rawName.trim();
      // The header row never matches: "Model ID" starts uppercase, failing the
      // lowercase-anchored modelId group. Dash separator rows likewise start
      // with '-', not [A-Za-z]. So any row reaching this point is a data row.
      if (seen.has(modelId)) continue;
      seen.add(modelId);
      entries.push({
        id: modelId,
        displayName,
        format: endpointSuffix === 'messages' ? 'anthropic' : 'openai',
        costPerRequestUsd: costByName.get(normalizeDisplayName(displayName)) ?? null,
      });
    }
    return entries;
  }

  /**
   * Parse the Usage Limits table. Maps normalized display name → USD per
   * request, derived from the published 5-hour request count. The Endpoints
   * table is excluded by anchoring on three numeric columns after the name.
   */
  private parseLimits(mdx: string): Map<string, number> {
    const limitsRe =
      /\|\s*([A-Za-z][^|]*?)\s*\|\s*([0-9][0-9,]*)\s*\|\s*([0-9][0-9,]*)\s*\|\s*([0-9][0-9,]*)\s*\|/g;
    const out = new Map<string, number>();
    let match: RegExpExecArray | null;
    while ((match = limitsRe.exec(mdx)) !== null) {
      const [, rawName, rawRequests] = match;
      const requestsPer5h = Number(rawRequests.replace(/,/g, ''));
      if (!Number.isFinite(requestsPer5h) || requestsPer5h <= 0) continue;
      const key = normalizeDisplayName(rawName);
      // First occurrence wins, mirroring the Endpoints table's dedup behaviour.
      if (out.has(key)) continue;
      out.set(key, OPENCODE_GO_BUDGET_5H_USD / requestsPer5h);
    }
    return out;
  }

  private rebuildCostIndex(entries: OpencodeGoCatalogEntry[]): void {
    const next = new Map<string, number>();
    for (const entry of entries) {
      if (entry.costPerRequestUsd != null) {
        next.set(entry.id, entry.costPerRequestUsd);
      }
    }
    this.costByModelId = next;
  }

  /** Test hook: clear in-memory state. */
  resetCache(): void {
    this.cache = null;
    this.lastGood = null;
    this.costByModelId = new Map();
  }
}

/**
 * Normalize a docs display name for cross-table matching. The Endpoints
 * table lists "MiMo-V2.5" while the Usage Limits table lists
 * "MiMo-V2.5 (≤ 256K)". Lowercase, strip any parenthesized suffix, and
 * collapse whitespace so the two forms collide on the same key.
 */
function normalizeDisplayName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
