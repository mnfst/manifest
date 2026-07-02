import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Agent } from '../../entities/agent.entity';
import type { ForwardResult } from '../proxy/provider-client';
import type { ProxyApiMode } from '../proxy/proxy-types';
import { HEALING_CLIENT, type HealingClient } from './healing-client';
import { normalizeProviderError } from './provider-error-normalizer';
import type { AutofixChainEntry, AutofixOutcome, AutofixRecord } from './autofix.types';
import type { HealOutcome, HealResponse } from './phoenix.types';

export interface MaybeHealParams {
  forward: ForwardResult;
  agentId: string;
  tenantId: string;
  provider: string;
  apiMode: ProxyApiMode;
  /** The request body that was actually forwarded and failed. */
  requestBody: Record<string, unknown>;
  /** Optional endpoint URL, forwarded to Phoenix as readability context. */
  url?: string;
  /** Re-send a patched body to the provider and return the fresh forward. */
  reforward: (healedBody: Record<string, unknown>) => Promise<ForwardResult>;
}

export interface AutofixAttempt {
  /** Forward to continue with: a healed 200, or the original error rebuilt. */
  forward: ForwardResult;
  record: AutofixRecord;
}

interface AgentAutofixConfig {
  enabled: boolean;
  maxAttempts: number;
}

const DEFAULT_REPAIRABLE_STATUSES = '400,404,422';
const CONFIG_CACHE_TTL_MS = 30_000;
const CONFIG_CACHE_MAX = 5_000;

function parseStatuses(raw: string | undefined): Set<number> {
  const source = raw && raw.trim().length > 0 ? raw : DEFAULT_REPAIRABLE_STATUSES;
  const parsed = source
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 400 && n < 500);
  return new Set(parsed.length > 0 ? parsed : DEFAULT_REPAIRABLE_STATUSES.split(',').map(Number));
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function rebuildForward(base: ForwardResult, body: string, status: number): ForwardResult {
  return {
    ...base,
    response: new Response(body, { status, headers: headersToObject(base.response.headers) }),
  };
}

/**
 * Auto-fix: heal a repairable request-side 4xx by handing the failed request and
 * its provider error to Phoenix, resending the patched body, and looping up to a
 * per-agent budget — all BEFORE the fallback chain runs. A no-op unless the
 * forward already failed with a repairable status AND the agent opted in, so
 * successful traffic is never touched. Any unexpected failure inside the flow
 * degrades to the original provider error — healing never makes a request worse.
 */
@Injectable()
export class AutofixService {
  private readonly logger = new Logger(AutofixService.name);
  private readonly globalEnabled: boolean;
  private readonly defaultMaxAttempts: number;
  private readonly repairableStatuses: Set<number>;
  private readonly configCache = new Map<
    string,
    { value: AgentAutofixConfig; expiresAt: number }
  >();

  constructor(
    @Inject(HEALING_CLIENT) private readonly client: HealingClient,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    config: ConfigService,
  ) {
    this.globalEnabled = config.get<string>('AUTOFIX_GLOBAL_ENABLED') !== 'false';
    const parsedMax = Number.parseInt(config.get<string>('AUTOFIX_DEFAULT_MAX_ATTEMPTS') ?? '', 10);
    this.defaultMaxAttempts = Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : 3;
    this.repairableStatuses = parseStatuses(config.get<string>('AUTOFIX_REPAIRABLE_STATUSES'));
  }

  /** Whether a status is one Auto-fix will try to heal. */
  isRepairable(status: number): boolean {
    return this.repairableStatuses.has(status);
  }

  /** Drop a cached per-agent config so a toggle/budget change takes effect now. */
  invalidateConfig(tenantId: string, agentId: string): void {
    this.configCache.delete(`${tenantId}:${agentId}`);
  }

  async maybeHeal(params: MaybeHealParams): Promise<AutofixAttempt | null> {
    const { forward } = params;
    // Hot path: successful and non-repairable forwards never enter healing.
    if (forward.response.ok || !this.globalEnabled) return null;
    const status = forward.response.status;
    if (!this.isRepairable(status)) return null;

    let cfg: AgentAutofixConfig;
    try {
      cfg = await this.loadAgentConfig(params.agentId, params.tenantId);
    } catch (err) {
      // A config-load failure (DB hiccup) must never turn a recoverable provider
      // error into a crash — skip healing; the forward is still intact.
      this.logger.warn(`autofix config load failed, skipping: ${(err as Error).message}`);
      return null;
    }
    if (!cfg.enabled) return null;

    // Read the original error once, then rebuild it so it stays readable
    // downstream (fallback / recorder) whether or not we heal.
    const originalText = await forward.response.text();
    const originalForward = rebuildForward(forward, originalText, status);

    try {
      return await this.runHealLoop(params, status, originalText, originalForward, cfg.maxAttempts);
    } catch (err) {
      // Any unexpected failure inside the loop (reforward, network, parsing…)
      // degrades to the original provider error — never a Manifest 500.
      this.logger.warn(`autofix loop failed, using original error: ${(err as Error).message}`);
      return {
        forward: originalForward,
        record: {
          groupId: uuid(),
          outcome: 'exhausted',
          attempts: 0,
          original_http_status: status,
          chain: [],
        },
      };
    }
  }

  private async runHealLoop(
    params: MaybeHealParams,
    status: number,
    originalText: string,
    originalForward: ForwardResult,
    maxAttempts: number,
  ): Promise<AutofixAttempt> {
    const groupId = uuid();
    const chain: AutofixChainEntry[] = [];
    let currentBody = params.requestBody;
    let currentStatus = status;
    let currentText = originalText;
    let attempts = 0;
    let outcome: AutofixOutcome = 'exhausted';
    let healedForward: ForwardResult | null = null;

    while (attempts < maxAttempts) {
      const normalized = normalizeProviderError(currentText);
      // No same-error short-circuit: each iteration re-asks Phoenix and reports
      // the retry outcome, so a patch that doesn't clear the error yields a fresh
      // heal-attempt (and Phoenix a fresh failure signal) until the budget is spent.

      const entry: AutofixChainEntry = {
        attempt: attempts,
        origin: attempts === 0 ? 'original' : 'autofix',
        request: currentBody,
        http_status: currentStatus,
        error: normalized,
      };
      chain.push(entry);

      let heal: HealResponse;
      try {
        heal = await this.client.heal({
          // Stable across every retry of one logical request (Phoenix groups the
          // heal-attempt timeline by it) — reuse the group id we already minted.
          requestId: groupId,
          provider: params.provider,
          api: params.apiMode,
          url: params.url,
          request: currentBody,
          response: { statusCode: currentStatus, error: normalized },
        });
      } catch (err) {
        this.logger.warn(`heal call failed: ${(err as Error).message}`);
        break;
      }

      entry.phoenix_status = heal.status;
      entry.issue_id = heal.issueId;
      entry.patch_id = heal.patchId ?? null;
      entry.heal_attempt_id = heal.healAttemptId ?? null;
      entry.operations = heal.operations ?? null;

      if (heal.status === 'no_patch') {
        outcome = 'unfixable';
        break;
      }
      if (heal.status === 'resolving') {
        outcome = 'resolving';
        break;
      }
      if (!heal.healedBody || !heal.healAttemptId) {
        outcome = 'unfixable';
        break;
      }

      const healAttemptId = heal.healAttemptId;
      currentBody = heal.healedBody;
      attempts += 1;
      const next = await params.reforward(currentBody);
      const ok = next.response.ok;
      entry.patch_worked = ok;

      if (ok) {
        // Report the cleared retry so Phoenix can promote the patch.
        this.reportOutcome(healAttemptId, { retryStatusCode: next.response.status });
        outcome = 'healed';
        healedForward = next;
        chain.push({
          attempt: attempts,
          origin: 'autofix',
          request: currentBody,
          http_status: next.response.status,
        });
        break;
      }

      currentStatus = next.response.status;
      currentText = await next.response.text();
      // Report the new error after retry — Phoenix decides succeeded (different
      // error) vs failed (same error recurred).
      this.reportOutcome(healAttemptId, {
        retryStatusCode: currentStatus,
        error: normalizeProviderError(currentText),
      });
      if (!this.isRepairable(currentStatus)) break;
    }

    return {
      forward: healedForward ?? originalForward,
      record: { groupId, outcome, attempts, original_http_status: status, chain },
    };
  }

  private async loadAgentConfig(agentId: string, tenantId: string): Promise<AgentAutofixConfig> {
    const key = `${tenantId}:${agentId}`;
    const now = Date.now();
    const cached = this.configCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

    const agent = await this.agentRepo.findOne({
      where: { id: agentId, tenant_id: tenantId },
      select: ['autofix_enabled', 'autofix_max_attempts'],
    });
    const budget = agent?.autofix_max_attempts;
    const value: AgentAutofixConfig =
      agent && agent.autofix_enabled
        ? {
            enabled: true,
            maxAttempts:
              Number.isInteger(budget) && (budget as number) > 0
                ? (budget as number)
                : this.defaultMaxAttempts,
          }
        : { enabled: false, maxAttempts: 0 };

    // Only the failure path reaches here; caching keeps a 4xx storm from doing a
    // DB read per failed request. Bounded + short TTL, invalidated on config change.
    if (this.configCache.size >= CONFIG_CACHE_MAX) this.configCache.clear();
    this.configCache.set(key, { value, expiresAt: now + CONFIG_CACHE_TTL_MS });
    return value;
  }

  /** Fire-and-forget the learning signal so it never delays the client. */
  private reportOutcome(healAttemptId: string, outcome: HealOutcome): void {
    void this.client.reportOutcome(healAttemptId, outcome).catch((err: unknown) => {
      this.logger.warn(`reportOutcome ${healAttemptId} failed: ${(err as Error).message}`);
    });
  }
}
