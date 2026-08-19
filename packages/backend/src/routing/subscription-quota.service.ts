import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  normalizeProviderName,
  SHARED_PROVIDER_BY_ID_OR_ALIAS,
  supportsQuotaCheck,
} from 'manifest-shared';
import { TenantProvider } from '../entities/tenant-provider.entity';
import { AnthropicOauthService } from './oauth/anthropic/anthropic-oauth.service';
import { OpenaiOauthService } from './oauth/openai/openai-oauth.service';
import { MinimaxOauthService } from './oauth/minimax/minimax-oauth.service';
import { XaiOauthService } from './oauth/xai/xai-oauth.service';
import { decrypt, getEncryptionSecret } from '../common/utils/crypto.util';

export interface SubscriptionQuotaState {
  exhausted: boolean;
  resetsAt: string | null;
  checkedAt: number;
  error?: string;
}

export const DEFAULT_QUOTA_POLL_INTERVAL_MS = 60_000;
export const MIN_QUOTA_POLL_INTERVAL_MS = 30_000;
const QUOTA_FETCH_TIMEOUT_MS = 10_000;

const ANTHROPIC_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const KIMI_USAGE_URL = 'https://api.kimi.com/coding/v1/usages';
const OPENAI_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io';
const XAI_USAGE_URL = 'https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig';
/** Empty protobuf message, gRPC-web framed — the GetGrokCreditsConfig request body. */
const XAI_USAGE_BODY = new Uint8Array([0, 0, 0, 0, 0]);

/** Canonical ids of the providers with a quota endpoint. */
type QuotaProviderKind = 'anthropic' | 'moonshot' | 'openai' | 'minimax' | 'xai';

/** Poll cadence from SUBSCRIPTION_QUOTA_POLL_INTERVAL_MS, clamped to >= 30s. */
export function resolveQuotaPollIntervalMs(raw: string | undefined): number {
  // Digits-only (surrounding whitespace tolerated): parseInt would silently
  // accept a numeric prefix like '60000junk'.
  const trimmed = raw?.trim() ?? '';
  if (!/^\d+$/.test(trimmed)) return DEFAULT_QUOTA_POLL_INTERVAL_MS;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed > 2147483647) return DEFAULT_QUOTA_POLL_INTERVAL_MS;
  return Math.max(parsed, MIN_QUOTA_POLL_INTERVAL_MS);
}

/** Canonical id for providers with a quota endpoint, else null. */
function quotaProviderKind(provider: string): QuotaProviderKind | null {
  const lower = String(provider || '')
    .trim()
    .toLowerCase();
  const entry =
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(lower) ??
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalizeProviderName(lower));
  const id = entry?.id ?? lower;
  return id === 'anthropic' ||
    id === 'moonshot' ||
    id === 'openai' ||
    id === 'minimax' ||
    id === 'xai'
    ? id
    : null;
}

interface QuotaVerdict {
  exhausted: boolean;
  resetsAt: string | null;
}

/** Earliest parseable timestamp among the candidates, else null. */
function earliestReset(candidates: (string | null)[]): string | null {
  let best: string | null = null;
  let bestMs = Infinity;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const ms = Date.parse(candidate);
    if (!Number.isFinite(ms) || ms >= bestMs) continue;
    best = candidate;
    bestMs = ms;
  }
  return best;
}

/**
 * Anthropic OAuth usage: exhausted when ANY window (5h, 7d, or the per-model
 * 7d windows) reports utilization >= 100. The connection stays exhausted until
 * the earliest reset among the exhausted windows.
 */
export function parseAnthropicUsage(data: unknown): QuotaVerdict {
  const body = (data ?? {}) as Record<string, unknown>;
  const windows = [
    'five_hour',
    'seven_day',
    'seven_day_sonnet',
    'seven_day_opus',
    'seven_day_oauth_apps',
  ]
    .map((key) => body[key])
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object');
  const exhausted = windows.filter(
    (w) => typeof w.utilization === 'number' && w.utilization >= 100,
  );
  if (exhausted.length === 0) return { exhausted: false, resetsAt: null };
  return {
    exhausted: true,
    resetsAt: earliestReset(
      exhausted.map((w) => (typeof w.resets_at === 'string' ? w.resets_at : null)),
    ),
  };
}

/**
 * Kimi reports every quota number as a string; NaN when missing or corrupt.
 * Callers must check Number.isFinite before comparing — a missing value must
 * never read as 0 and trip a `<= 0` / `>= limit` exhaustion check (fail-open).
 */
function kimiNumber(value: unknown): number {
  if (value === null || value === undefined) return NaN;
  const text = String(value).trim();
  if (!text) return NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Kimi Coding Plan usage: weekly + 5h rolling windows exhaust when
 * used >= limit (limit > 0); the monthly window exhausts when
 * remaining <= 0. The 5h window is the limits[] entry with a 300-minute
 * duration (fallback: the first entry). Monthly has no reset time, so a
 * monthly-only exhaustion yields resetsAt = null.
 */
export function parseKimiUsage(data: unknown): QuotaVerdict {
  const body = (data ?? {}) as Record<string, unknown>;
  let exhausted = false;
  const resets: (string | null)[] = [];

  const weekly = body.usage as Record<string, unknown> | undefined;
  if (weekly && typeof weekly === 'object') {
    const used = kimiNumber(weekly.used);
    const limit = kimiNumber(weekly.limit);
    if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0 && used >= limit) {
      exhausted = true;
      resets.push(typeof weekly.resetTime === 'string' ? weekly.resetTime : null);
    }
  }

  const limits = Array.isArray(body.limits) ? (body.limits as Record<string, unknown>[]) : [];
  const rolling =
    limits.find((entry) => {
      const window = entry?.window as Record<string, unknown> | undefined;
      return window?.duration === 300 && window?.timeUnit === 'TIME_UNIT_MINUTE';
    }) ?? limits[0];
  const detail = rolling?.detail as Record<string, unknown> | undefined;
  if (detail && typeof detail === 'object') {
    const used = kimiNumber(detail.used);
    const limit = kimiNumber(detail.limit);
    if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0 && used >= limit) {
      exhausted = true;
      resets.push(typeof detail.resetTime === 'string' ? detail.resetTime : null);
    }
  }

  const monthly = body.totalQuota as Record<string, unknown> | undefined;
  if (monthly && typeof monthly === 'object') {
    const limit = kimiNumber(monthly.limit);
    const remaining = kimiNumber(monthly.remaining);
    if (Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0 && remaining <= 0) {
      exhausted = true;
    }
  }

  return exhausted
    ? { exhausted: true, resetsAt: earliestReset(resets) }
    : { exhausted: false, resetsAt: null };
}

/** Epoch milliseconds → ISO string; null for missing/non-numeric input. */
function epochMsToIso(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Date(value).toISOString();
}

/**
 * ChatGPT subscription usage: rate_limit carries a primary (5h) and a
 * secondary (weekly) window, each { used_percent, reset_at } with reset_at in
 * epoch SECONDS. Exhausted when ANY window hits 100%; resetsAt is the earliest
 * reset among the exhausted windows. credits/individual_limit/
 * additional_rate_limits are ignored for now.
 */
export function parseOpenAiUsage(data: unknown): QuotaVerdict {
  const body = (data ?? {}) as Record<string, unknown>;
  const rateLimit = body.rate_limit as Record<string, unknown> | undefined;
  if (!rateLimit || typeof rateLimit !== 'object') return { exhausted: false, resetsAt: null };
  const windows = ['primary_window', 'secondary_window']
    .map((key) => rateLimit[key])
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object');
  const exhausted = windows.filter(
    (w) => typeof w.used_percent === 'number' && w.used_percent >= 100,
  );
  if (exhausted.length === 0) return { exhausted: false, resetsAt: null };
  let resetsAt: string | null = null;
  let bestMs = Infinity;
  for (const w of exhausted) {
    if (typeof w.reset_at !== 'number' || !Number.isFinite(w.reset_at)) continue;
    const ms = w.reset_at * 1000;
    if (ms < bestMs) {
      bestMs = ms;
      resetsAt = new Date(ms).toISOString();
    }
  }
  return { exhausted: true, resetsAt };
}

/**
 * MiniMax Token Plan usage: model_remains[] carries per-model quota windows.
 * The 'general' entry holds the LLM quota (fallback: the first entry). The
 * percents are REMAINING percents — a window is exhausted when it drops to 0.
 * The *_total_count/*_usage_count fields are always 0 on time-based plans and
 * must not be used. Reset times are epoch MILLISECONDS (end_time for the 5h
 * interval, weekly_end_time for the weekly window).
 *
 * Throws on a non-zero base_resp.status_code (business error, e.g. 2062 "no
 * active plan") so the caller treats it as a fetch failure and fails open.
 */
export function parseMinimaxUsage(data: unknown): QuotaVerdict {
  const body = (data ?? {}) as Record<string, unknown>;
  const baseResp = body.base_resp as Record<string, unknown> | undefined;
  if (baseResp && typeof baseResp.status_code === 'number' && baseResp.status_code !== 0) {
    throw new Error(`MiniMax usage returned status_code ${baseResp.status_code}`);
  }
  const remains = Array.isArray(body.model_remains)
    ? (body.model_remains as Record<string, unknown>[])
    : [];
  if (remains.length === 0) return { exhausted: false, resetsAt: null };
  const entry = remains.find((e) => e?.model_name === 'general') ?? remains[0];

  let exhausted = false;
  const resets: (string | null)[] = [];
  const intervalPct = entry.current_interval_remaining_percent;
  if (typeof intervalPct === 'number' && intervalPct <= 0) {
    exhausted = true;
    resets.push(epochMsToIso(entry.end_time));
  }
  const weeklyPct = entry.current_weekly_remaining_percent;
  if (typeof weeklyPct === 'number' && weeklyPct <= 0) {
    exhausted = true;
    resets.push(epochMsToIso(entry.weekly_end_time));
  }
  return exhausted
    ? { exhausted: true, resetsAt: earliestReset(resets) }
    : { exhausted: false, resetsAt: null };
}

/* ── xAI (Grok) gRPC-web + protobuf parsing ──────────────────────────────
 * Ported from the reference implementation in the unmerged upstream
 * subscription-usage PR, adapted to this service's exported-pure-function
 * style. The grok.com billing endpoint answers with gRPC-web framed
 * protobuf, so the parser splits frames, validates the trailer's
 * grpc-status, then heuristically scans the protobuf payload — no protobuf
 * library needed. */

interface ProtobufFixed32Field {
  path: number[];
  value: number;
  order: number;
}

interface ProtobufVarintField {
  path: number[];
  value: number;
}

interface ProtobufScan {
  fixed32Fields: ProtobufFixed32Field[];
  varintFields: ProtobufVarintField[];
  order: number;
}

function readVarint(data: Uint8Array, start: number): { value: number; index: number } | null {
  let value = 0;
  let shift = 0;
  let index = start;
  while (index < data.length && shift < 64) {
    const byte = data[index];
    index += 1;
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return { value, index };
    shift += 7;
  }
  return null;
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function decodeGrpcValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Data (non-trailer) gRPC-web frames, or null when the bytes aren't framed. */
export function grpcWebDataFrames(data: Uint8Array): Uint8Array[] | null {
  if (data.length === 0) return null;
  const frames: Uint8Array[] = [];
  let index = 0;
  while (index < data.length) {
    if (index + 5 > data.length) return null;
    const flags = data[index];
    if ((flags & 0x7e) !== 0) return null;
    const length =
      data[index + 1] * 2 ** 24 +
      (data[index + 2] << 16) +
      (data[index + 3] << 8) +
      data[index + 4];
    const start = index + 5;
    const end = start + length;
    if (end > data.length) return null;
    if ((flags & 0x80) === 0) frames.push(data.slice(start, end));
    index = end;
  }
  return frames;
}

/** Trailer gRPC-web frames decoded into lowercase header fields. */
export function grpcWebTrailerFields(data: Uint8Array): Record<string, string> {
  const fields: Record<string, string> = {};
  let index = 0;
  while (index + 5 <= data.length) {
    const flags = data[index];
    const length =
      data[index + 1] * 2 ** 24 +
      (data[index + 2] << 16) +
      (data[index + 3] << 8) +
      data[index + 4];
    const start = index + 5;
    const end = start + length;
    if (end > data.length) break;
    if ((flags & 0x80) !== 0) {
      const text = Buffer.from(data.slice(start, end)).toString('utf8');
      for (const line of text.split(/\r?\n/)) {
        const separator = line.indexOf(':');
        if (separator === -1) continue;
        fields[line.slice(0, separator).trim().toLowerCase()] = decodeGrpcValue(
          line.slice(separator + 1).trim(),
        );
      }
    }
    index = end;
  }
  return fields;
}

function throwGrpcStatus(status: string, message: string): never {
  throw new Error(`gRPC ${status}: ${message}`);
}

/** Throws unless the trailer reports success (grpc-status 0 or absent). */
export function validateGrpcStatusFields(fields: Record<string, string>): void {
  const status = fields['grpc-status'];
  if (!status || status === '0') return;
  throwGrpcStatus(status, fields['grpc-message'] ?? '');
}

/** Cheap shape check: could these bytes be a bare protobuf message? */
function looksLikeProtobufPayload(data: Uint8Array): boolean {
  const first = data[0];
  if (first === undefined) return false;
  const fieldNumber = first >> 3;
  const wireType = first & 0x07;
  return fieldNumber > 0 && (wireType === 0 || wireType === 1 || wireType === 2 || wireType === 5);
}

/**
 * Dependency-free heuristic protobuf scanner: walks length-delimited messages
 * up to depth 4 and collects every fixed32 (float) and varint field with its
 * field-number path. Fixed32 fields carry an `order` so ties between equally
 * shallow percent candidates resolve to the first occurrence.
 */
function scanProtobuf(
  data: Uint8Array,
  depth: number,
  path: number[] = [],
  order = 0,
): ProtobufScan {
  const scan: ProtobufScan = { fixed32Fields: [], varintFields: [], order };
  let index = 0;

  while (index < data.length) {
    const fieldStart = index;
    const key = readVarint(data, index);
    if (!key || key.value === 0) {
      index = fieldStart + 1;
      continue;
    }
    index = key.index;
    const fieldNumber = Math.floor(key.value / 8);
    const wireType = key.value % 8;
    const fieldPath = [...path, fieldNumber];

    if (wireType === 0) {
      const value = readVarint(data, index);
      if (value) {
        scan.varintFields.push({ path: fieldPath, value: value.value });
        index = value.index;
      } else {
        index = fieldStart + 1;
      }
    } else if (wireType === 1) {
      if (index + 8 > data.length) return scan;
      index += 8;
    } else if (wireType === 2) {
      const length = readVarint(data, index);
      if (!length || length.value > data.length - length.index) {
        index = fieldStart + 1;
        continue;
      }
      index = length.index;
      const end = index + length.value;
      if (depth < 4) {
        const nested = scanProtobuf(data.slice(index, end), depth + 1, fieldPath, scan.order);
        scan.fixed32Fields.push(...nested.fixed32Fields);
        scan.varintFields.push(...nested.varintFields);
        scan.order = nested.order;
      }
      index = end;
    } else if (wireType === 5) {
      if (index + 4 > data.length) return scan;
      const view = new DataView(data.buffer, data.byteOffset + index, 4);
      scan.fixed32Fields.push({
        path: fieldPath,
        value: view.getFloat32(0, true),
        order: scan.order,
      });
      scan.order += 1;
      index += 4;
    } else {
      index = fieldStart + 1;
    }
  }

  return scan;
}

export interface XaiUsageSnapshot {
  usedPercent: number;
  resetsAt: string | null;
}

/**
 * Grok web billing (GetGrokCreditsConfig): the used percent is the
 * shallowest/first fixed32 field whose path ends in segment 1 with a 0-100
 * value; reset candidates are future varint fields in the plausible epoch
 * range [1.7e9, 2.1e9], preferring path [1,5,1] then the earliest. Throws
 * (fail-open) when the response carries no protobuf payload, or when neither
 * a percent nor a plausible reset can be found.
 */
export function parseXaiUsage(data: Uint8Array): XaiUsageSnapshot {
  const framedPayloads = grpcWebDataFrames(data);
  const payloads =
    framedPayloads === null && looksLikeProtobufPayload(data) ? [data] : (framedPayloads ?? []);
  if (payloads.length === 0) {
    throw new Error('Grok web billing returned no protobuf payload');
  }

  const scan = payloads.reduce<ProtobufScan>(
    (merged, payload) => {
      const next = scanProtobuf(payload, 0, [], merged.order);
      merged.fixed32Fields.push(...next.fixed32Fields);
      merged.varintFields.push(...next.varintFields);
      merged.order = next.order;
      return merged;
    },
    { fixed32Fields: [], varintFields: [], order: 0 },
  );

  const percent = scan.fixed32Fields
    .filter(
      (field) =>
        field.path[field.path.length - 1] === 1 &&
        Number.isFinite(field.value) &&
        field.value >= 0 &&
        field.value <= 100,
    )
    .sort((a, b) => a.path.length - b.path.length || a.order - b.order)[0]?.value;

  const nowSeconds = Date.now() / 1000;
  const resetCandidates = scan.varintFields
    .filter((field) => field.value >= 1_700_000_000 && field.value <= 2_100_000_000)
    .filter((field) => field.value > nowSeconds)
    .sort((a, b) => a.value - b.value);
  const reset =
    resetCandidates.find((field) => pathsEqual(field.path, [1, 5, 1])) ?? resetCandidates[0];

  if (percent === undefined && !reset) {
    throw new Error('Could not parse Grok web billing usage');
  }

  return {
    usedPercent: percent ?? 0,
    resetsAt: reset ? new Date(reset.value * 1000).toISOString() : null,
  };
}

/**
 * Polls the usage endpoints of subscription connections whose providers expose
 * one (Anthropic Claude, Kimi Coding Plan, ChatGPT, MiniMax Token Plan, Grok)
 * and keeps an in-memory exhaustion snapshot per `tenant_providers` row.
 * ResolveService consults the snapshot to skip routes flagged
 * `skipWhenQuotaExhausted`.
 *
 * Fail-open everywhere: fetch errors, unwrap failures, and missing data never
 * mark a connection exhausted, and a failed refresh keeps the previous state.
 */
@Injectable()
export class SubscriptionQuotaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionQuotaService.name);
  private readonly states = new Map<string, SubscriptionQuotaState>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(TenantProvider)
    private readonly providerRepo: Repository<TenantProvider>,
    private readonly anthropicOauth: AnthropicOauthService,
    private readonly openaiOauth: OpenaiOauthService,
    private readonly minimaxOauth: MinimaxOauthService,
    private readonly xaiOauth: XaiOauthService,
  ) {}

  onModuleInit(): void {
    const intervalMs = resolveQuotaPollIntervalMs(process.env.SUBSCRIPTION_QUOTA_POLL_INTERVAL_MS);
    this.timer = setInterval(() => {
      void this.pollSafely();
    }, intervalMs);
    // Don't keep the process alive for the poller (tests, CLI runs).
    this.timer.unref?.();
    // Kick one immediate poll without blocking module init.
    void this.pollSafely();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * True when the connection is known to be exhausted and its earliest reset
   * time is still in the future. No data, stale errors, or a reset time that
   * has already passed all read as NOT exhausted (fail-open).
   */
  isQuotaExhausted(tenantProviderId: string): boolean {
    const state = this.states.get(tenantProviderId);
    if (!state || !state.exhausted) return false;
    if (state.resetsAt) {
      const resetMs = Date.parse(state.resetsAt);
      if (Number.isFinite(resetMs) && resetMs <= Date.now()) return false;
    }
    return true;
  }

  /** Snapshot for future UI surfaces; undefined when never polled. */
  getQuotaState(tenantProviderId: string): SubscriptionQuotaState | undefined {
    const state = this.states.get(tenantProviderId);
    return state ? { ...state } : undefined;
  }

  private async pollSafely(): Promise<void> {
    try {
      await this.poll();
    } catch (err) {
      this.logger.warn(`Subscription quota poll failed: ${err}`);
    }
  }

  private async poll(): Promise<void> {
    const rows = await this.providerRepo.find({
      where: { auth_type: 'subscription', is_active: true },
    });
    const targets = rows.filter((row) => row.api_key_encrypted && supportsQuotaCheck(row.provider));
    // Prune snapshots for connections that were deleted or deactivated since
    // the last poll — the map would otherwise grow (and serve stale reads)
    // forever.
    const targetIds = new Set(targets.map((row) => row.id));
    for (const id of this.states.keys()) {
      if (!targetIds.has(id)) this.states.delete(id);
    }
    await Promise.all(targets.map((row) => this.refreshOne(row)));
  }

  private async refreshOne(row: TenantProvider): Promise<void> {
    try {
      const kind = quotaProviderKind(row.provider);
      if (!kind) return;
      const credential = await this.resolveCredential(row, kind);
      if (!credential) throw new Error('no usable access token');
      const verdict = await this.fetchUsage(kind, credential);
      this.states.set(row.id, { ...verdict, checkedAt: Date.now() });
    } catch (err) {
      // Fail-open: keep the previous verdict; with no history store a
      // non-exhausted state so the route is never skipped on unknown data.
      const previous = this.states.get(row.id);
      this.states.set(row.id, {
        exhausted: previous?.exhausted ?? false,
        resetsAt: previous?.resetsAt ?? null,
        checkedAt: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      });
      this.logger.debug(
        `Quota refresh failed for provider=${row.provider} connection=${row.id}: ${err}`,
      );
    }
  }

  /**
   * Decrypt the stored credential and resolve it to a usable bearer token.
   * OAuth-blob providers (Anthropic, OpenAI, MiniMax, xAI) reuse the same
   * unwrap/refresh path the proxy uses at request time so expired tokens
   * refresh here too; MiniMax additionally yields the resource URL the usage
   * endpoint's base is derived from. Kimi tokens are raw `sk-kimi-` keys used
   * as-is.
   */
  private async resolveCredential(
    row: TenantProvider,
    kind: QuotaProviderKind,
  ): Promise<{ token: string; resourceUrl?: string } | null> {
    if (!row.api_key_encrypted) return null;
    const raw = decrypt(row.api_key_encrypted, getEncryptionSecret());
    const agentId = row.agent_id ?? '';
    if (kind === 'anthropic') {
      const token = await this.anthropicOauth.unwrapToken(raw, agentId, row.tenant_id, row.label);
      return token ? { token } : null;
    }
    if (kind === 'openai') {
      const token = await this.openaiOauth.unwrapToken(raw, agentId, row.tenant_id, row.label);
      return token ? { token } : null;
    }
    if (kind === 'minimax') {
      const unwrapped = await this.minimaxOauth.unwrapToken(raw, agentId, row.tenant_id, row.label);
      return unwrapped?.t ? { token: unwrapped.t, resourceUrl: unwrapped.u } : null;
    }
    if (kind === 'xai') {
      const token = await this.xaiOauth.unwrapToken(raw, agentId, row.tenant_id, row.label);
      return token ? { token } : null;
    }
    return raw ? { token: raw } : null;
  }

  private fetchUsage(
    kind: QuotaProviderKind,
    credential: { token: string; resourceUrl?: string },
  ): Promise<QuotaVerdict> {
    switch (kind) {
      case 'anthropic':
        return this.fetchAnthropicUsage(credential.token);
      case 'moonshot':
        return this.fetchKimiUsage(credential.token);
      case 'openai':
        return this.fetchOpenAiUsage(credential.token);
      case 'minimax':
        return this.fetchMinimaxUsage(credential.token, credential.resourceUrl);
      case 'xai':
        return this.fetchXaiUsage(credential.token);
    }
  }

  private async fetchAnthropicUsage(token: string): Promise<QuotaVerdict> {
    const response = await fetch(ANTHROPIC_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-code/2.1.0',
      },
      signal: AbortSignal.timeout(QUOTA_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Anthropic usage fetch failed: HTTP ${response.status}`);
    }
    return parseAnthropicUsage(await response.json());
  }

  private async fetchKimiUsage(token: string): Promise<QuotaVerdict> {
    const response = await fetch(KIMI_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(QUOTA_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Kimi usage fetch failed: HTTP ${response.status}`);
    }
    return parseKimiUsage(await response.json());
  }

  private async fetchOpenAiUsage(token: string): Promise<QuotaVerdict> {
    const response = await fetch(OPENAI_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'Manifest',
      },
      signal: AbortSignal.timeout(QUOTA_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`OpenAI usage fetch failed: HTTP ${response.status}`);
    }
    return parseOpenAiUsage(await response.json());
  }

  /**
   * The usage endpoint lives on the same origin as the provider's resource
   * URL (stored in the OAuth blob's `u`); fall back to the public api host
   * when the blob carries no usable URL.
   */
  private async fetchMinimaxUsage(token: string, resourceUrl?: string): Promise<QuotaVerdict> {
    let base = MINIMAX_DEFAULT_BASE_URL;
    if (resourceUrl) {
      try {
        base = new URL(resourceUrl).origin;
      } catch {
        // keep the default base
      }
    }
    const response = await fetch(`${base}/v1/token_plan/remains`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(QUOTA_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`MiniMax usage fetch failed: HTTP ${response.status}`);
    }
    return parseMinimaxUsage(await response.json());
  }

  /**
   * Grok's billing endpoint answers gRPC-web: grpc-status may arrive as a
   * header on error responses, otherwise the trailer frame carries it. Both
   * are validated before parsing the protobuf payload.
   */
  private async fetchXaiUsage(token: string): Promise<QuotaVerdict> {
    const response = await fetch(XAI_USAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'https://grok.com',
        Referer: 'https://grok.com/?_s=usage',
        Accept: '*/*',
        'Content-Type': 'application/grpc-web+proto',
        'x-grpc-web': '1',
        'x-user-agent': 'connect-es/2.1.1',
        'User-Agent': 'Manifest',
      },
      body: XAI_USAGE_BODY,
      signal: AbortSignal.timeout(QUOTA_FETCH_TIMEOUT_MS),
    });
    const headerStatus = response.headers.get('grpc-status');
    if (headerStatus && headerStatus !== '0') {
      throwGrpcStatus(headerStatus, response.headers.get('grpc-message') ?? '');
    }
    if (!response.ok) {
      throw new Error(`xAI usage fetch failed: HTTP ${response.status}`);
    }
    const data = new Uint8Array(await response.arrayBuffer());
    validateGrpcStatusFields(grpcWebTrailerFields(data));
    const snapshot = parseXaiUsage(data);
    return { exhausted: snapshot.usedPercent >= 100, resetsAt: snapshot.resetsAt };
  }
}
