import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Agent } from '../../entities/agent.entity';
import { Tenant } from '../../entities/tenant.entity';
import { isSelfHosted } from '../../common/utils/detect-self-hosted';
import type { ForwardResult } from '../proxy/provider-client';
import type { ProxyApiMode } from '../proxy/proxy-types';
import { HEALING_CLIENT, HealContractError, type HealingClient } from './healing-client';
import { normalizeProviderError } from './provider-error-normalizer';
import type { AutofixChainEntry, AutofixRecord } from './autofix.types';
import type { HealOutcome, HealResponse } from './phoenix.types';

export interface MaybeHealParams {
  forward: ForwardResult;
  agentId: string;
  tenantId: string;
  provider: string;
  apiMode: ProxyApiMode;
  /** The request body that was actually forwarded and failed. */
  requestBody: Record<string, unknown>;
  /**
   * The resolved provider model (e.g. `gpt-5.1`) the request was routed to.
   * `requestBody.model` may be a routing alias (`auto`) Phoenix can't map to its
   * model-keyed catalog; this concrete model is reported to Phoenix instead so
   * its resolver can identify the model. The reforward still goes through the
   * agent's routing. Omit when the body already carries the concrete model.
   */
  resolvedModel?: string;
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
}

const DEFAULT_REPAIRABLE_STATUSES = '400,404,422';
const CONFIG_CACHE_TTL_MS = 30_000;
const CONFIG_CACHE_MAX = 5_000;

// Circuit breaker for the healing service. After this many consecutive heal-call
// transport failures (timeout / unreachable), stop calling Phoenix for the
// cooldown window so a slow or down healer stops adding latency to every
// repairable 4xx BEFORE the fallback chain (the next safety net) gets to run.
const HEAL_FAILURE_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 30_000;

function parseStatuses(raw: string | undefined): Set<number> {
  const source = raw && raw.trim().length > 0 ? raw : DEFAULT_REPAIRABLE_STATUSES;
  const parsed = source
    .split(',')
    .map((s) => s.trim())
    // Digits-only: reject malformed tokens like `'404abc'` (which `parseInt` would
    // silently accept as `404`) so a typo can't quietly enable/disable a status.
    .filter((s) => /^\d+$/.test(s))
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => n >= 400 && n < 500);
  return new Set(parsed.length > 0 ? parsed : DEFAULT_REPAIRABLE_STATUSES.split(',').map(Number));
}

/** The three Auto-fix rollout phases, most→least restrictive. */
type AutofixRollout = 'selected' | 'waitlist' | 'everyone';

/**
 * Parse `AUTOFIX_ROLLOUT`:
 * - `selected` (default) — only tenants WE hand-picked (`autofix_access_granted_at`).
 * - `waitlist` — granted tenants **plus** anyone who joined the waitlist.
 * - `everyone` — general availability, no gate.
 */
function parseRollout(raw: string | undefined): AutofixRollout {
  const v = raw?.trim().toLowerCase();
  return v === 'waitlist' || v === 'everyone' ? v : 'selected';
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
 * its provider error to Phoenix and resending the patched body ONCE — all BEFORE
 * the fallback chain runs. A no-op unless the forward already failed with a
 * repairable status AND the agent opted in, so successful traffic is never
 * touched. Any unexpected failure inside the flow degrades to the original
 * provider error — healing never makes a request worse.
 */
@Injectable()
export class AutofixService {
  private readonly logger = new Logger(AutofixService.name);
  private readonly globalEnabled: boolean;
  // Which rollout phase this deployment is in (AUTOFIX_ROLLOUT). Governs how
  // `hasAccess` decides: `selected` (hand-picked only) → `waitlist` (+ opt-ins)
  // → `everyone` (GA). Default `selected` — the most restrictive.
  private readonly rollout: AutofixRollout;
  // Effective default when an agent has no explicit choice (autofix_enabled NULL):
  // ON in cloud, OFF in self-hosted. Computed once at boot.
  private readonly defaultAgentEnabled: boolean;
  private readonly repairableStatuses: Set<number>;
  private readonly configCache = new Map<
    string,
    { value: AgentAutofixConfig; expiresAt: number }
  >();
  // Per-tenant early-access decision, cached like the config so a 4xx storm from
  // a non-access tenant never does a DB read per failed request.
  private readonly accessCache = new Map<string, { value: boolean; expiresAt: number }>();
  // Circuit-breaker state (process-local). `breakerOpenUntil` is an epoch-ms
  // deadline; while it is in the future, heal calls are skipped.
  private healFailureStreak = 0;
  private breakerOpenUntil = 0;

  constructor(
    @Inject(HEALING_CLIENT) private readonly client: HealingClient,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    config: ConfigService,
  ) {
    this.globalEnabled = config.get<string>('AUTOFIX_GLOBAL_ENABLED') !== 'false';
    this.rollout = parseRollout(config.get<string>('AUTOFIX_ROLLOUT'));
    this.defaultAgentEnabled = !isSelfHosted();
    this.repairableStatuses = parseStatuses(config.get<string>('AUTOFIX_REPAIRABLE_STATUSES'));
  }

  /**
   * Whether a tenant may use Auto-fix at all, per the current rollout phase
   * (`AUTOFIX_ROLLOUT`):
   * - `selected` (default) → only tenants WE granted (`autofix_access_granted_at`).
   * - `waitlist` → granted tenants **plus** anyone who joined (`autofix_waitlist_at`).
   * - `everyone` → all tenants.
   *
   * This gate sits ABOVE the per-agent default (`resolveEnabled`): a non-access
   * tenant never heals, even when the cloud mode default would turn Auto-fix on.
   * Cached to avoid a per-4xx DB read.
   */
  async hasAccess(tenantId: string | null): Promise<boolean> {
    // No tenant context → no agent, so nothing to heal; deny in every phase.
    if (!tenantId) return false;
    // Phase 3 — general availability: everyone, no DB read.
    if (this.rollout === 'everyone') return true;
    const now = Date.now();
    const cached = this.accessCache.get(tenantId);
    if (cached && cached.expiresAt > now) return cached.value;

    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      select: ['autofix_access_granted_at', 'autofix_waitlist_at'],
    });
    // Phase 1 (`selected`): only hand-picked (granted) tenants.
    // Phase 2 (`waitlist`): granted OR opted in via the waitlist.
    const granted = tenant?.autofix_access_granted_at != null;
    const joined = tenant?.autofix_waitlist_at != null;
    const value = granted || (this.rollout === 'waitlist' && joined);
    if (this.accessCache.size >= CONFIG_CACHE_MAX) this.accessCache.clear();
    this.accessCache.set(tenantId, { value, expiresAt: now + CONFIG_CACHE_TTL_MS });
    return value;
  }

  /** Drop a tenant's cached access so a fresh waitlist join takes effect now. */
  invalidateAccess(tenantId: string): void {
    this.accessCache.delete(tenantId);
  }

  /**
   * Resolve an agent's stored Auto-fix flag to an effective on/off value. A
   * NULL/undefined flag means "no explicit choice" and inherits the
   * deployment-mode default: ON in cloud, OFF in self-hosted.
   */
  resolveEnabled(stored: boolean | null | undefined): boolean {
    return stored ?? this.defaultAgentEnabled;
  }

  /** Whether a status is one Auto-fix will try to heal. */
  isRepairable(status: number): boolean {
    return this.repairableStatuses.has(status);
  }

  /** Drop a cached per-agent config so a toggle change takes effect now. */
  invalidateConfig(tenantId: string, agentId: string): void {
    this.configCache.delete(`${tenantId}:${agentId}`);
  }

  /** A heal call reached the healer (any decision) — clear the failure streak. */
  private recordHealSuccess(): void {
    this.healFailureStreak = 0;
  }

  /**
   * A heal call failed at the transport layer (timeout / unreachable). Once the
   * streak crosses the threshold, open the breaker for the cooldown window so
   * subsequent failures stop adding latency to the request path.
   */
  private recordHealFailure(): void {
    this.healFailureStreak += 1;
    if (this.healFailureStreak >= HEAL_FAILURE_THRESHOLD) {
      this.breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
      this.healFailureStreak = 0;
      this.logger.warn(
        `autofix: healing service unreachable — circuit breaker open for ${BREAKER_COOLDOWN_MS}ms`,
      );
    }
  }

  async maybeHeal(params: MaybeHealParams): Promise<AutofixAttempt | null> {
    const { forward } = params;
    // Hot path: successful and non-repairable forwards never enter healing.
    if (forward.response.ok || !this.globalEnabled) return null;
    const status = forward.response.status;
    if (!this.isRepairable(status)) return null;

    // Circuit breaker: while the healing service is tripped, skip healing
    // entirely and hand the forward back untouched, so a slow/unreachable
    // Phoenix never delays the fallback chain (the next safety net).
    if (this.breakerOpenUntil > Date.now()) return null;

    let cfg: AgentAutofixConfig;
    try {
      // Limited-rollout gate: only early-access (waitlist) tenants heal for now.
      // Sits above the per-agent default so a cloud tenant that hasn't joined
      // never heals, even though the mode default would enable it.
      if (!(await this.hasAccess(params.tenantId))) return null;
      cfg = await this.loadAgentConfig(params.agentId, params.tenantId);
    } catch (err) {
      // A gate-load failure (DB hiccup) must never turn a recoverable provider
      // error into a crash — skip healing; the forward is still intact.
      this.logger.warn(`autofix gate load failed, skipping: ${(err as Error).message}`);
      return null;
    }
    if (!cfg.enabled) return null;

    // Read the original error once, then rebuild it so it stays readable
    // downstream (fallback / recorder) whether or not we heal.
    const originalText = await forward.response.text();
    const originalForward = rebuildForward(forward, originalText, status);

    try {
      return await this.runHealOnce(params, status, originalText, originalForward);
    } catch (err) {
      // Defensive backstop: the common reforward failure is handled inside
      // runHealOnce (which preserves the chain), so this only fires on a truly
      // unexpected throw (e.g. reading the failed retry body). Degrade to the
      // original provider error — never a Manifest 500.
      this.logger.warn(`autofix failed, using original error: ${(err as Error).message}`);
      return {
        forward: originalForward,
        record: { groupId: uuid(), outcome: 'exhausted', original_http_status: status, chain: [] },
      };
    }
  }

  /**
   * One heal attempt: ask Phoenix, and if it hands out a patch, resend the
   * patched body exactly once. There is no retry budget — a patch that doesn't
   * clear the error is reported to Phoenix and then we give up (the fallback
   * chain is the next safety net).
   */
  private async runHealOnce(
    params: MaybeHealParams,
    status: number,
    originalText: string,
    originalForward: ForwardResult,
  ): Promise<AutofixAttempt> {
    const groupId = uuid();
    const normalized = normalizeProviderError(originalText);

    const entry: AutofixChainEntry = {
      attempt: 0,
      origin: 'original',
      request: params.requestBody,
      http_status: status,
      error: normalized,
    };
    const chain: AutofixChainEntry[] = [entry];

    // The agent's body may carry a routing alias as its model (e.g. `auto`), but
    // Phoenix fingerprints and resolves against the concrete provider model.
    // Report the resolved model to Phoenix so its model-keyed catalog resolver
    // can identify the model; the reforward below still routes via the alias.
    const routingModel = params.requestBody.model;
    const phoenixRequest =
      typeof params.resolvedModel === 'string' &&
      params.resolvedModel.length > 0 &&
      params.resolvedModel !== routingModel
        ? { ...params.requestBody, model: params.resolvedModel }
        : params.requestBody;

    let heal: HealResponse;
    try {
      heal = await this.client.heal({
        traceId: groupId,
        tenantId: params.tenantId,
        provider: params.provider,
        api: params.apiMode,
        url: params.url,
        request: phoenixRequest,
        response: { statusCode: status, error: normalized },
      });
    } catch (err) {
      if (err instanceof HealContractError) {
        // Phoenix is reachable but rejected the request (4xx) — a contract or
        // API-key bug on our side, not an outage. Don't trip the breaker (that
        // would just mask it); surface it loudly so it gets fixed.
        this.logger.error(
          `autofix: Phoenix rejected the heal request (HTTP ${err.status}) — check the ` +
            `wire contract and AUTOFIX_HEALING_API_KEY: ${err.message}`,
        );
      } else {
        this.recordHealFailure();
        this.logger.warn(`heal call failed: ${(err as Error).message}`);
      }
      return {
        forward: originalForward,
        record: { groupId, outcome: 'exhausted', original_http_status: status, chain },
      };
    }
    // The healer answered (any decision) — it is alive, so clear the streak.
    this.recordHealSuccess();

    entry.phoenix_status = heal.status;
    entry.issue_id = heal.issueId;
    entry.patch_id = heal.patchId ?? null;
    entry.heal_attempt_id = heal.healAttemptId ?? null;
    entry.operations = heal.operations ?? null;
    entry.explanation = heal.explanation ?? null;

    // Phoenix is still authoring a patch for this novel error — nothing to resend.
    if (heal.status === 'resolving') {
      return {
        forward: originalForward,
        record: { groupId, outcome: 'resolving', original_http_status: status, chain },
      };
    }
    // No patch available (or a malformed patch response) — give up cleanly.
    if (heal.status === 'no_patch' || !heal.healedBody || !heal.healAttemptId) {
      return {
        forward: originalForward,
        record: { groupId, outcome: 'unfixable', original_http_status: status, chain },
      };
    }

    // A patch to apply: reached on `patched` (already verified) or `unverified`
    // (a fresh patch) — and any future patch-bearing status — because the guard
    // above keys off the presence of healedBody + healAttemptId, not a status
    // allow-list. Keep it that way so a new Phoenix status never silently no-ops.
    const healAttemptId = heal.healAttemptId;
    const healedBody = heal.healedBody;
    // Phoenix echoes back the model we sent it (the resolved provider model). The
    // reforward must go through the agent's routing, so restore the original
    // routing alias — unless Phoenix itself changed the model (a model-fix patch),
    // which `reforwardHealed` intentionally re-resolves.
    const bodyToReforward =
      typeof routingModel === 'string' &&
      healedBody.model === phoenixRequest.model &&
      phoenixRequest.model !== routingModel
        ? { ...healedBody, model: routingModel }
        : healedBody;
    let next: ForwardResult;
    try {
      next = await params.reforward(bodyToReforward);
    } catch (err) {
      // The patched resend threw (a provider transport error, NOT a Phoenix
      // failure — so it must not trip the heal breaker). Preserve the audit chain
      // (the original error plus the Phoenix issue/patch ids already stamped on
      // `entry`) instead of dropping it, and degrade to the original provider
      // error; the fallback chain is the next safety net.
      this.logger.warn(`autofix reforward failed, using original error: ${(err as Error).message}`);
      entry.patch_worked = false;
      return {
        forward: originalForward,
        record: { groupId, outcome: 'unfixable', original_http_status: status, chain },
      };
    }
    const ok = next.response.ok;
    entry.patch_worked = ok;

    if (ok) {
      // Report the cleared retry so Phoenix can promote the patch.
      this.reportOutcome(healAttemptId, { retryStatusCode: next.response.status });
      chain.push({
        attempt: 1,
        origin: 'autofix',
        request: bodyToReforward,
        http_status: next.response.status,
      });
      return {
        forward: next,
        record: { groupId, outcome: 'healed', original_http_status: status, chain },
      };
    }

    // The patch didn't clear the error. Report the retry outcome to Phoenix and
    // give up — a single attempt, no re-heal.
    const retryText = await next.response.text();
    this.reportOutcome(healAttemptId, {
      retryStatusCode: next.response.status,
      error: normalizeProviderError(retryText),
    });
    return {
      forward: originalForward,
      record: { groupId, outcome: 'unfixable', original_http_status: status, chain },
    };
  }

  private async loadAgentConfig(agentId: string, tenantId: string): Promise<AgentAutofixConfig> {
    const key = `${tenantId}:${agentId}`;
    const now = Date.now();
    const cached = this.configCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

    const agent = await this.agentRepo.findOne({
      where: { id: agentId, tenant_id: tenantId },
      select: ['autofix_enabled'],
    });
    // Unknown agent → off. Known agent → its explicit flag, or the mode default
    // when unset (NULL).
    const value: AgentAutofixConfig = {
      enabled: agent ? this.resolveEnabled(agent.autofix_enabled) : false,
    };

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
