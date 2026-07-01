import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../entities/agent.entity';
import { TenantProvider } from '../entities/tenant-provider.entity';
import { decrypt, getEncryptionSecret } from '../common/utils/crypto.util';
import { scrubSecrets } from '../common/utils/secret-scrub';
import { OpenaiOauthService } from './oauth/openai/openai-oauth.service';
import { AnthropicOauthService } from './oauth/anthropic/anthropic-oauth.service';
import { GeminiOauthService } from './oauth/gemini/gemini-oauth.service';
import { parseOAuthTokenBlob } from './oauth/core';

type SubscriptionUsageProvider = 'openai' | 'anthropic' | 'gemini';
type SubscriptionConnectionStatus = 'ok' | 'unavailable' | 'error';

export interface SubscriptionUsageWindow {
  id: string;
  label: string;
  used_percent: number | null;
  remaining_percent: number | null;
  resets_at: string | null;
  window_seconds: number | null;
  current: number | null;
  limit: number | null;
  unit: string | null;
}

export interface SubscriptionUsageConnection {
  id: string;
  label: string;
  status: SubscriptionConnectionStatus;
  message: string | null;
  updated_at: string;
  windows: SubscriptionUsageWindow[];
}

export interface SubscriptionUsageSummary {
  provider: SubscriptionUsageProvider;
  auth_type: 'subscription';
  status: SubscriptionConnectionStatus | 'partial';
  updated_at: string;
  connections: SubscriptionUsageConnection[];
}

interface OpenAIUsageResponse {
  plan_type?: unknown;
  rate_limit?: {
    primary_window?: unknown;
    secondary_window?: unknown;
    individual_limit?: unknown;
  };
  credits?: unknown;
  individual_limit?: unknown;
  additional_rate_limits?: unknown;
}

interface OpenAIWindowLike {
  used_percent?: unknown;
  reset_at?: unknown;
  limit_window_seconds?: unknown;
}

interface OpenAISpendLimitLike {
  used?: unknown;
  limit?: unknown;
  remaining_percent?: unknown;
  remainingPercent?: unknown;
  resets_at?: unknown;
  resetsAt?: unknown;
}

interface ClaudeUsageResponse {
  five_hour?: unknown;
  seven_day?: unknown;
  seven_day_oauth_apps?: unknown;
  seven_day_sonnet?: unknown;
  seven_day_opus?: unknown;
  seven_day_routines?: unknown;
  seven_day_claude_routines?: unknown;
  claude_routines?: unknown;
  routines?: unknown;
  routine?: unknown;
  seven_day_cowork?: unknown;
  cowork?: unknown;
  iguana_necktie?: unknown;
  extra_usage?: unknown;
}

interface ClaudeWindowLike {
  utilization?: unknown;
  resets_at?: unknown;
}

interface GeminiQuotaResponse {
  buckets?: Array<{
    remainingFraction?: unknown;
    resetTime?: unknown;
    modelId?: unknown;
    tokenType?: unknown;
  }>;
}

const SUPPORTED_PROVIDERS = new Set<SubscriptionUsageProvider>(['openai', 'anthropic', 'gemini']);
const FETCH_TIMEOUT_MS = 12_000;

class SubscriptionUsageFetchError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SubscriptionUsageFetchError';
  }
}

@Injectable()
export class SubscriptionUsageService {
  private readonly logger = new Logger(SubscriptionUsageService.name);

  constructor(
    @InjectRepository(TenantProvider)
    private readonly providerRepo: Repository<TenantProvider>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly openaiOauth: OpenaiOauthService,
    private readonly anthropicOauth: AnthropicOauthService,
    private readonly geminiOauth: GeminiOauthService,
  ) {}

  async getUsage(tenantId: string | null): Promise<SubscriptionUsageSummary[]> {
    if (!tenantId) return [];

    const [providers, fallbackAgent] = await Promise.all([
      this.providerRepo.find({ where: { tenant_id: tenantId, auth_type: 'subscription' } }),
      this.agentRepo.findOne({ where: { tenant_id: tenantId } }),
    ]);

    const grouped = new Map<SubscriptionUsageProvider, TenantProvider[]>();
    for (const provider of providers) {
      const providerId = provider.provider.toLowerCase() as SubscriptionUsageProvider;
      if (!SUPPORTED_PROVIDERS.has(providerId)) continue;
      const group = grouped.get(providerId) ?? [];
      group.push(provider);
      grouped.set(providerId, group);
    }

    const summaries = await Promise.all(
      Array.from(grouped.entries()).map(async ([provider, rows]) => {
        const connections = await Promise.all(
          rows
            .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
            .map((row) => this.fetchConnectionUsage(provider, row, fallbackAgent?.id ?? null)),
        );
        return {
          provider,
          auth_type: 'subscription' as const,
          status: this.groupStatus(connections),
          updated_at: new Date().toISOString(),
          connections,
        };
      }),
    );

    return summaries.sort((a, b) => a.provider.localeCompare(b.provider));
  }

  private async fetchConnectionUsage(
    provider: SubscriptionUsageProvider,
    row: TenantProvider,
    fallbackAgentId: string | null,
  ): Promise<SubscriptionUsageConnection> {
    const base = {
      id: row.id,
      label: row.label,
      updated_at: new Date().toISOString(),
    };

    if (!row.is_active) {
      return {
        ...base,
        status: 'unavailable',
        message: 'Connection is inactive',
        windows: [],
      };
    }

    const rawCredential = this.decryptCredential(row);
    if (!rawCredential) {
      return {
        ...base,
        status: 'unavailable',
        message: 'Credential is unavailable',
        windows: [],
      };
    }

    const agentId = row.agent_id ?? fallbackAgentId;
    const token = await this.resolveAccessToken(provider, rawCredential, row, agentId);
    if (!token) {
      return {
        ...base,
        status: 'unavailable',
        message: 'Sign in again to refresh usage limits',
        windows: [],
      };
    }

    try {
      const windows =
        provider === 'openai'
          ? await this.fetchOpenAIUsage(token)
          : provider === 'anthropic'
            ? await this.fetchAnthropicUsage(token)
            : await this.fetchGeminiUsage(token, rawCredential);
      return {
        ...base,
        status: windows.length > 0 ? 'ok' : 'unavailable',
        message: windows.length > 0 ? null : 'No limit windows returned',
        windows,
      };
    } catch (error) {
      this.logFetchFailure(provider, row.label, error);
      return {
        ...base,
        status: this.isAuthOrRateLimitError(error) ? 'unavailable' : 'error',
        message: this.errorMessage(error),
        windows: [],
      };
    }
  }

  private decryptCredential(row: TenantProvider): string | null {
    if (!row.api_key_encrypted) return null;
    try {
      return decrypt(row.api_key_encrypted, getEncryptionSecret());
    } catch {
      return null;
    }
  }

  private async resolveAccessToken(
    provider: SubscriptionUsageProvider,
    rawCredential: string,
    row: TenantProvider,
    agentId: string | null,
  ): Promise<string | null> {
    if (!agentId) {
      const blob = parseOAuthTokenBlob(rawCredential);
      if (blob && Date.now() < blob.e - 60_000) return blob.t;
      if (provider === 'anthropic' && !blob) return rawCredential;
      return null;
    }

    if (provider === 'openai') {
      return this.openaiOauth.unwrapToken(rawCredential, agentId, row.tenant_id, row.label);
    }
    if (provider === 'anthropic') {
      return this.anthropicOauth.unwrapToken(rawCredential, agentId, row.tenant_id, row.label);
    }
    return this.geminiOauth.unwrapToken(rawCredential, agentId, row.tenant_id, row.label);
  }

  private async fetchOpenAIUsage(accessToken: string): Promise<SubscriptionUsageWindow[]> {
    const payload = await this.fetchJson<OpenAIUsageResponse>(
      'https://chatgpt.com/backend-api/wham/usage',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'User-Agent': 'Manifest',
        },
      },
    );

    const windows: SubscriptionUsageWindow[] = [];
    this.addOpenAIWindow(windows, 'codex-5h', 'Codex 5h', payload.rate_limit?.primary_window);
    this.addOpenAIWindow(
      windows,
      'codex-weekly',
      'Codex weekly',
      payload.rate_limit?.secondary_window,
    );
    this.addOpenAISpendLimit(
      windows,
      'codex-monthly',
      'Monthly credits',
      payload.individual_limit ?? payload.rate_limit?.individual_limit,
    );
    this.addOpenAICredits(windows, payload.credits);

    if (Array.isArray(payload.additional_rate_limits)) {
      payload.additional_rate_limits.forEach((entry, index) => {
        if (!isRecord(entry)) return;
        const title = this.humanizeLimitName(
          stringValue(entry['limit_name']) ?? stringValue(entry['metered_feature']),
        );
        const rateLimit = isRecord(entry['rate_limit']) ? entry['rate_limit'] : null;
        this.addOpenAIWindow(
          windows,
          `codex-extra-${index}-primary`,
          `${title} 5h`,
          rateLimit?.['primary_window'],
        );
        this.addOpenAIWindow(
          windows,
          `codex-extra-${index}-weekly`,
          `${title} weekly`,
          rateLimit?.['secondary_window'],
        );
      });
    }

    return windows;
  }

  private async fetchAnthropicUsage(accessToken: string): Promise<SubscriptionUsageWindow[]> {
    const payload = await this.fetchJson<ClaudeUsageResponse>(
      'https://api.anthropic.com/api/oauth/usage',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'anthropic-beta': 'oauth-2025-04-20',
          'User-Agent': 'claude-code/2.1.0',
        },
      },
    );

    const windows: SubscriptionUsageWindow[] = [];
    this.addClaudeWindow(windows, 'claude-5h', 'Claude 5h', payload.five_hour);
    this.addClaudeWindow(windows, 'claude-weekly', 'Claude weekly', payload.seven_day);
    this.addClaudeWindow(
      windows,
      'claude-oauth-apps-weekly',
      'OAuth apps weekly',
      payload.seven_day_oauth_apps,
    );
    this.addClaudeWindow(
      windows,
      'claude-sonnet-weekly',
      'Sonnet weekly',
      payload.seven_day_sonnet,
    );
    this.addClaudeWindow(windows, 'claude-opus-weekly', 'Opus weekly', payload.seven_day_opus);
    this.addClaudeWindow(
      windows,
      'claude-routines-weekly',
      'Daily routines',
      payload.seven_day_routines ??
        payload.seven_day_claude_routines ??
        payload.claude_routines ??
        payload.routines ??
        payload.routine ??
        payload.seven_day_cowork ??
        payload.cowork,
    );
    this.addClaudeWindow(windows, 'claude-iguana-necktie', 'Extra weekly', payload.iguana_necktie);
    this.addClaudeExtraUsage(windows, payload.extra_usage);
    return windows;
  }

  private async fetchGeminiUsage(
    accessToken: string,
    rawCredential: string,
  ): Promise<SubscriptionUsageWindow[]> {
    const projectId = parseOAuthTokenBlob(rawCredential)?.u;
    const payload = await this.fetchJson<GeminiQuotaResponse>(
      'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectId ? { project: projectId } : {}),
      },
    );

    const byModel = new Map<string, { remaining: number; reset: string | null }>();
    for (const bucket of payload.buckets ?? []) {
      const modelId = stringValue(bucket.modelId);
      const remaining = numberValue(bucket.remainingFraction);
      if (!modelId || remaining === null) continue;
      const existing = byModel.get(modelId);
      if (!existing || remaining < existing.remaining) {
        byModel.set(modelId, {
          remaining,
          reset: stringValue(bucket.resetTime),
        });
      }
    }

    return Array.from(byModel.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([modelId, quota]) => {
        const remainingPercent = clampPercent(quota.remaining * 100);
        return {
          id: `gemini-${modelId}`,
          label: this.humanizeGeminiModel(modelId),
          used_percent: remainingPercent === null ? null : clampPercent(100 - remainingPercent),
          remaining_percent: remainingPercent,
          resets_at: parseIsoDate(quota.reset),
          window_seconds: null,
          current: null,
          limit: null,
          unit: 'quota',
        };
      });
  }

  private addOpenAIWindow(
    windows: SubscriptionUsageWindow[],
    id: string,
    label: string,
    raw: unknown,
  ) {
    if (!isRecord(raw)) return;
    const data = raw as OpenAIWindowLike;
    const usedPercent = clampPercent(numberValue(data.used_percent));
    if (usedPercent === null) return;
    windows.push({
      id,
      label,
      used_percent: usedPercent,
      remaining_percent: clampPercent(100 - usedPercent),
      resets_at: epochToIso(data.reset_at),
      window_seconds: integerValue(data.limit_window_seconds),
      current: null,
      limit: null,
      unit: null,
    });
  }

  private addOpenAISpendLimit(
    windows: SubscriptionUsageWindow[],
    id: string,
    label: string,
    raw: unknown,
  ) {
    if (!isRecord(raw)) return;
    const data = raw as OpenAISpendLimitLike;
    const used = numberValue(data.used);
    const limit = numberValue(data.limit);
    const remainingPercent =
      clampPercent(numberValue(data.remaining_percent ?? data.remainingPercent)) ??
      (used !== null && limit !== null && limit > 0
        ? clampPercent(100 - (used / limit) * 100)
        : null);
    if (used === null && limit === null && remainingPercent === null) return;
    windows.push({
      id,
      label,
      used_percent: remainingPercent === null ? null : clampPercent(100 - remainingPercent),
      remaining_percent: remainingPercent,
      resets_at: epochToIso(data.resets_at ?? data.resetsAt),
      window_seconds: null,
      current: used,
      limit,
      unit: 'credits',
    });
  }

  private addOpenAICredits(windows: SubscriptionUsageWindow[], raw: unknown) {
    if (!isRecord(raw)) return;
    const balance = numberValue(raw['balance']);
    if (balance === null) return;
    windows.push({
      id: 'codex-credits',
      label: 'Credits balance',
      used_percent: null,
      remaining_percent: null,
      resets_at: null,
      window_seconds: null,
      current: balance,
      limit: null,
      unit: 'credits',
    });
  }

  private addClaudeWindow(
    windows: SubscriptionUsageWindow[],
    id: string,
    label: string,
    raw: unknown,
  ) {
    if (!isRecord(raw)) return;
    const data = raw as ClaudeWindowLike;
    const usedPercent = clampPercent(numberValue(data.utilization));
    if (usedPercent === null) return;
    windows.push({
      id,
      label,
      used_percent: usedPercent,
      remaining_percent: clampPercent(100 - usedPercent),
      resets_at: parseIsoDate(stringValue(data.resets_at)),
      window_seconds: null,
      current: null,
      limit: null,
      unit: null,
    });
  }

  private addClaudeExtraUsage(windows: SubscriptionUsageWindow[], raw: unknown) {
    if (!isRecord(raw)) return;
    const used = numberValue(raw['used_credits']);
    const limit = numberValue(raw['monthly_limit']);
    const usedPercent =
      clampPercent(numberValue(raw['utilization'])) ??
      (used !== null && limit !== null && limit > 0 ? clampPercent((used / limit) * 100) : null);
    if (used === null && limit === null && usedPercent === null) return;
    windows.push({
      id: 'claude-extra-usage',
      label: 'Extra usage',
      used_percent: usedPercent,
      remaining_percent: usedPercent === null ? null : clampPercent(100 - usedPercent),
      resets_at: null,
      window_seconds: null,
      current: used,
      limit,
      unit: stringValue(raw['currency']) ?? 'credits',
    });
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new SubscriptionUsageFetchError(response.status, text);
      }
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof SubscriptionUsageFetchError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SubscriptionUsageFetchError(408, 'Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private groupStatus(
    connections: SubscriptionUsageConnection[],
  ): SubscriptionUsageSummary['status'] {
    if (connections.length === 0) return 'unavailable';
    const okCount = connections.filter((connection) => connection.status === 'ok').length;
    if (okCount === connections.length) return 'ok';
    if (okCount > 0) return 'partial';
    return connections.some((connection) => connection.status === 'error')
      ? 'error'
      : 'unavailable';
  }

  private isAuthOrRateLimitError(error: unknown): boolean {
    return (
      error instanceof SubscriptionUsageFetchError &&
      (error.status === 401 || error.status === 403 || error.status === 408 || error.status === 429)
    );
  }

  private errorMessage(error: unknown): string {
    if (error instanceof SubscriptionUsageFetchError) {
      if (error.status === 401 || error.status === 403)
        return 'Sign in again to refresh usage limits';
      if (error.status === 429) return 'Provider rate-limited the usage lookup';
      if (error.status === 408) return 'Usage lookup timed out';
      return 'Usage lookup failed';
    }
    return 'Usage lookup failed';
  }

  private logFetchFailure(provider: string, label: string, error: unknown) {
    const message =
      error instanceof SubscriptionUsageFetchError
        ? `HTTP ${error.status}: ${scrubSecrets(error.message).slice(0, 300)}`
        : error instanceof Error
          ? error.message
          : String(error);
    this.logger.warn(`Subscription usage lookup failed for ${provider}/${label}: ${message}`);
  }

  private humanizeLimitName(value: string | null): string {
    if (!value) return 'Model limit';
    return value
      .replace(/^codex[-_\s]*/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  private humanizeGeminiModel(modelId: string): string {
    return modelId
      .replace(/^models\//, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integerValue(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function clampPercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped * 10) / 10;
}

function epochToIso(value: unknown): string | null {
  const parsed = numberValue(value);
  if (parsed === null || parsed <= 0) return null;
  const ms = parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseIsoDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
