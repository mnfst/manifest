import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  classifyMessageError,
  deriveAutofixStatus,
  normalizeStatus,
  PENDING_STATUS,
  type RequestParamDefaults,
} from 'manifest-shared';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ManifestRequest } from '../../entities/request.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { FailedFallback } from './proxy-fallback.service';
import { StreamUsage } from './stream-writer';
import { ProxyMessageDedup } from './proxy-message-dedup';
import { computeTokenCost } from '../../common/utils/cost-calculator';
import { scrubSecrets } from '../../common/utils/secret-scrub';
import { CallerAttribution } from './caller-classifier';
import type { ProviderAttemptRef, ProviderAttemptStart } from './proxy-types';
import { CustomProviderService } from '../custom-provider/custom-provider.service';
import { OpencodeGoCatalogService } from '../../model-discovery/opencode-go-catalog.service';
import { PROVIDER_BY_ID_OR_ALIAS } from '../../common/constants/providers';
import type { ManifestErrorCode } from '../../common/errors/error-codes';
import type { ManifestBlockedRequestReason } from '../../common/errors/manifest-error';
import {
  getAutofixRetry,
  type AutofixChainEntry,
  type AutofixRecord,
} from '../autofix/autofix.types';
import { serializeProviderError } from '../autofix/provider-error-normalizer';
import { normalizeProviderErrorForStorage } from './proxy-error-sanitizer';

/**
 * Phoenix's decision metadata for a healed row: its issue/patch/heal-attempt ids
 * plus the human-readable "why" ({@link AutofixChainEntry.explanation}). Null when
 * the entry carries none (e.g. the heal call never reached Phoenix).
 */
function buildAutofixDecision(entry: AutofixChainEntry | undefined): object | null {
  if (!entry) return null;
  const present =
    entry.phoenix_status != null ||
    entry.issue_id != null ||
    entry.patch_id != null ||
    entry.heal_attempt_id != null ||
    entry.explanation != null;
  if (!present) return null;
  return {
    status: entry.phoenix_status ?? null,
    issueId: entry.issue_id ?? null,
    patchId: entry.patch_id ?? null,
    healAttemptId: entry.heal_attempt_id ?? null,
    explanation: entry.explanation ?? null,
  };
}

/**
 * Auto-fix audit for every Phoenix decision, plus linked-flow columns only when
 * Manifest actually sent a patched retry.
 */
function autofixColumns(
  autofix: AutofixRecord | undefined,
  role: 'original' | 'retry',
): Partial<AgentMessage> {
  if (!autofix) return {};
  // The heal decision (ids, operations, explanation) rides the attempt-0 entry.
  const healEntry = autofix.chain.find(
    (e) =>
      e.operations != null ||
      e.issue_id != null ||
      e.heal_attempt_id != null ||
      e.explanation != null,
  );
  const decision = buildAutofixDecision(healEntry);
  if (!getAutofixRetry(autofix)) {
    return decision ? { autofix_decision: decision } : {};
  }
  return {
    autofix_applied: true,
    autofix_group_id: autofix.groupId,
    autofix_role: role,
    autofix_operations: (healEntry?.operations as object | null) ?? null,
    autofix_decision: buildAutofixDecision(healEntry),
  };
}

function terminalAutofixRole(autofix: AutofixRecord | undefined): 'original' | 'retry' {
  return getAutofixRetry(autofix) ? 'retry' : 'original';
}

export interface HeaderTierRef {
  headerTierId?: string | null;
  headerTierName?: string | null;
  headerTierColor?: string | null;
}

export interface ProviderErrorOpts extends HeaderTierRef {
  requestId?: string;
  attemptNumber?: number;
  attempt?: ProviderAttemptRef;
  /** Finish the Request without creating a Provider Attempt. */
  skipAttempt?: boolean;
  requestDurationMs?: number;
  model?: string;
  provider?: string;
  tier?: string;
  traceId?: string;
  fallbackFromModel?: string;
  fallbackIndex?: number;
  authType?: string;
  /**
   * Why the tier was selected (e.g. 'header-match', 'specificity', 'scored').
   * Persisted to agent_messages.routing_reason so single-shot upstream errors
   * keep the same audit context as their successful siblings.
   */
  reason?: string;
  specificityCategory?: string;
  providerKeyLabel?: string;
  /**
   * The tenant_providers row (connection/key) that served this message.
   * Persisted to agent_messages.tenant_provider_id so per-connection analytics
   * scope by the exact key rather than the non-unique provider/auth/label tuple.
   */
  tenantProviderId?: string | null;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
  /**
   * Snapshot of effective request body parameters merged into the outbound
   * provider request. Persisted to `agent_messages.request_params`.
   */
  requestParams?: RequestParamDefaults | null;
  /** Auto-fix audit when this error was the terminal outcome after healing. */
  autofix?: AutofixRecord;
}

export type { ManifestBlockedRequestReason };

export interface ManifestBlockedRequestOpts {
  requestId?: string;
  /**
   * The status the caller saw, when there was one. Omitted for the HTTP-200
   * friendly stubs (no provider was contacted, so there is no upstream status
   * to record) — `error_http_status` then stays NULL, as it always has.
   */
  httpStatus?: number | null;
  errorMessage: string;
  /** The documented `M###` code, persisted so the UI can link to its doc page. */
  errorCode?: ManifestErrorCode;
  reason: ManifestBlockedRequestReason;
  model?: string;
  traceId?: string;
  sessionKey?: string;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
  /** End-to-end time until Manifest returned the rejection. */
  durationMs?: number;
}

export interface PendingRequestOpts {
  requestId: string;
  timestamp: string;
  traceId?: string;
  sessionKey?: string;
  requestedModel?: string;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
}

export interface FallbackSuccessOpts extends HeaderTierRef {
  requestId?: string;
  attemptNumber?: number;
  attempt?: ProviderAttemptRef;
  requestDurationMs?: number;
  traceId?: string;
  provider?: string;
  fallbackFromModel?: string;
  fallbackIndex?: number;
  timestamp?: string;
  authType?: string;
  /**
   * Why the primary tier was selected (e.g. 'header-match', 'specificity',
   * 'scored'). Persisted to agent_messages.routing_reason so fallback rows
   * keep the same audit context as their non-fallback siblings.
   */
  reason?: string;
  providerKeyLabel?: string;
  /**
   * The tenant_providers row (connection/key) that served this message.
   * Persisted to agent_messages.tenant_provider_id so per-connection analytics
   * scope by the exact key rather than the non-unique provider/auth/label tuple.
   */
  tenantProviderId?: string | null;
  usage?: StreamUsage;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
  /**
   * Snapshot of effective request body parameters (today: DeepSeek
   * `thinking`) merged into the outbound provider request. `null` when no
   * known params apply. Persisted to `agent_messages.request_params`.
   */
  requestParams?: RequestParamDefaults | null;
  /** Request-level Auto-fix outcome when a failed retry later fell back. */
  autofix?: AutofixRecord;
}

export interface SuccessMessageOpts extends HeaderTierRef {
  requestId?: string;
  attemptNumber?: number;
  attempt?: ProviderAttemptRef;
  traceId?: string;
  provider?: string;
  authType?: string;
  sessionKey?: string;
  durationMs?: number;
  specificityCategory?: string;
  providerKeyLabel?: string;
  /**
   * The tenant_providers row (connection/key) that served this message.
   * Persisted to agent_messages.tenant_provider_id so per-connection analytics
   * scope by the exact key rather than the non-unique provider/auth/label tuple.
   */
  tenantProviderId?: string | null;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
  requestParams?: RequestParamDefaults | null;
  /** Auto-fix audit when a healed request succeeded. */
  autofix?: AutofixRecord;
}

export interface AutofixOriginalOpts extends HeaderTierRef {
  requestId?: string;
  attemptNumber?: number;
  attempt?: ProviderAttemptRef;
  provider?: string;
  reason?: string;
  authType?: string;
  traceId?: string;
  specificityCategory?: string;
  providerKeyLabel?: string;
  tenantProviderId?: string | null;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
  requestParams?: RequestParamDefaults | null;
}

function buildMessageRow(
  ctx: IngestionContext,
  overrides: Partial<AgentMessage>,
): Partial<AgentMessage> {
  const row: Partial<AgentMessage> = {
    id: uuid(),
    tenant_id: ctx.tenantId,
    agent_id: ctx.agentId,
    agent_name: ctx.agentName,
    // Informational attribution only — never filtered on (see IngestionContext).
    user_id: ctx.userId,
    trace_id: null,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    ...overrides,
  };
  // Stamp the orthogonal error axes from this row's own signals so every insert
  // site is classified identically (and identically to the backfill migration).
  // classifyRow reads the *rich* status (`rate_limited` / `fallback_error` /
  // `auto_fixed`) to derive error_class + superseded, then the stored status is
  // collapsed onto the canonical `success`/`failed` vocabulary — the reason it
  // failed now lives entirely on those orthogonal columns.
  const classified = classifyRow(row);
  return { ...row, ...classified, status: normalizeStatus(row.status) };
}

function attemptIdentity(
  attempt: ProviderAttemptRef | undefined,
  attemptNumber: number | undefined,
): Partial<AgentMessage> {
  return attempt
    ? {
        id: attempt.id,
        attempt_number: attempt.attemptNumber,
        timestamp: attempt.startedAt,
      }
    : { attempt_number: attemptNumber ?? null };
}

function buildRequestRow(
  ctx: IngestionContext,
  requestId: string,
  attempt: Partial<AgentMessage>,
  terminal: boolean,
  autofix?: AutofixRecord,
): ManifestRequest {
  const classified = classifyRow(attempt);
  // classifyRow above reads the rich attempt status; the request row stores the
  // collapsed canonical outcome. A non-terminal request is still `pending`.
  const status = terminal ? normalizeStatus(attempt.status) : PENDING_STATUS;
  return {
    id: requestId,
    tenant_id: ctx.tenantId,
    agent_id: ctx.agentId,
    user_id: ctx.userId,
    agent_name: ctx.agentName,
    trace_id: attempt.trace_id ?? null,
    session_key: attempt.session_key ?? null,
    session_id: attempt.session_id ?? null,
    timestamp: attempt.timestamp ?? new Date().toISOString(),
    duration_ms: attempt.duration_ms ?? null,
    status,
    autofix_status: deriveAutofixStatus(autofix),
    error_message: terminal ? (attempt.error_message ?? null) : null,
    error_http_status: terminal ? (attempt.error_http_status ?? null) : null,
    error_code: terminal ? (attempt.error_code ?? null) : null,
    error_origin: terminal ? classified.error_origin : null,
    error_class: terminal ? classified.error_class : null,
    requested_model: attempt.fallback_from_model ?? attempt.model ?? null,
    caller_attribution: attempt.caller_attribution ?? null,
    request_headers: attempt.request_headers ?? null,
    request_params: attempt.request_params ?? null,
    feedback_rating: attempt.feedback_rating ?? null,
    feedback_tags: attempt.feedback_tags ?? null,
    feedback_details: attempt.feedback_details ?? null,
  };
}

/**
 * Derive `{ error_origin, error_class, superseded }` for a row from the same
 * signals the backfill reads, via the shared classifyMessageError source of
 * truth. A row with no explicit status is a success ('ok').
 */
function classifyRow(row: Partial<AgentMessage>): {
  error_origin: string | null;
  error_class: string | null;
  superseded: boolean;
} {
  if (normalizeStatus(row.status) === PENDING_STATUS) {
    return { error_origin: null, error_class: null, superseded: false };
  }
  return classifyMessageError({
    status: row.status ?? 'ok',
    errorHttpStatus: row.error_http_status,
    routingReason: row.routing_reason,
  });
}

@Injectable()
export class ProxyMessageRecorder implements OnModuleDestroy {
  private readonly logger = new Logger(ProxyMessageRecorder.name);
  private readonly rateLimitCooldown = new Map<string, number>();
  private readonly RATE_LIMIT_COOLDOWN_MS = 60_000;
  private readonly MAX_COOLDOWN_ENTRIES = 1_000;
  private readonly cooldownCleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly dedup: ProxyMessageDedup,
    private readonly eventBus: IngestEventBusService,
    private readonly customProviders: CustomProviderService,
    private readonly opencodeGoCatalog: OpencodeGoCatalogService,
  ) {
    this.cooldownCleanupTimer = setInterval(() => this.evictExpiredCooldowns(), 60_000);
    if (typeof this.cooldownCleanupTimer === 'object' && 'unref' in this.cooldownCleanupTimer) {
      this.cooldownCleanupTimer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cooldownCleanupTimer);
  }

  /**
   * Insert the parent before its attempts. Intermediate hops only insert the
   * initial pending row; the one terminal writer replaces it with the outcome
   * observed by the caller. This prevents a late fallback-error write from
   * downgrading a request that already succeeded.
   */
  private async persistRequest(
    ctx: IngestionContext,
    requestId: string,
    attempt: Partial<AgentMessage>,
    terminal: boolean,
    autofix?: AutofixRecord,
  ): Promise<boolean> {
    // Unit-test repository doubles predate the request table. Production
    // repositories always expose manager.getRepository().
    const getRepository = this.messageRepo.manager?.getRepository?.bind(this.messageRepo.manager);
    if (!getRepository) return false;
    const repo = getRepository(ManifestRequest);
    if (typeof repo.createQueryBuilder !== 'function') return false;
    const row = buildRequestRow(ctx, requestId, attempt, terminal, autofix);
    const insert = repo.createQueryBuilder().insert().into(ManifestRequest).values(row);
    if (terminal) {
      await insert
        .orUpdate(
          [
            'user_id',
            'agent_name',
            'trace_id',
            'session_key',
            'session_id',
            'duration_ms',
            'status',
            'autofix_status',
            'error_message',
            'error_http_status',
            'error_code',
            'error_origin',
            'error_class',
            'caller_attribution',
            'request_headers',
            'request_params',
          ],
          ['id'],
        )
        .execute();
    } else {
      await insert.orIgnore().execute();
    }
    return true;
  }

  /** Update the pending row when present; retain insert-only legacy/test paths. */
  private async persistAttempt(
    row: Partial<AgentMessage>,
    attempt?: ProviderAttemptRef,
  ): Promise<void> {
    const terminalRow = attempt
      ? {
          ...row,
          ...attemptIdentity(attempt, attempt.attemptNumber),
          duration_ms: Math.max(0, (attempt.completedAtMs ?? Date.now()) - attempt.startedAtMs),
        }
      : row;
    if (!attempt || !(await attempt.pendingWrite.catch(() => false))) {
      await this.messageRepo.insert(terminalRow);
      return;
    }
    const payload = { ...terminalRow };
    delete payload.id;
    await this.messageRepo.update({ id: attempt.id }, payload);
  }

  private shouldSkipRateLimitRecord(ctx: IngestionContext, scope?: string): boolean {
    const key = scope
      ? `${scope}:${ctx.tenantId}:${ctx.agentId}`
      : `${ctx.tenantId}:${ctx.agentId}`;
    const now = Date.now();
    const lastRecorded = this.rateLimitCooldown.get(key) ?? 0;
    if (now - lastRecorded < this.RATE_LIMIT_COOLDOWN_MS) return true;
    this.rateLimitCooldown.set(key, now);

    if (this.rateLimitCooldown.size > this.MAX_COOLDOWN_ENTRIES) {
      for (const [k, v] of this.rateLimitCooldown) {
        if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
      }
    }
    return false;
  }

  /** Persist the accepted Request before routing or provider work begins. */
  async recordPendingRequest(ctx: IngestionContext, opts: PendingRequestOpts): Promise<void> {
    await this.persistRequest(
      ctx,
      opts.requestId,
      {
        trace_id: opts.traceId ?? null,
        session_key: opts.sessionKey ?? null,
        timestamp: opts.timestamp,
        status: PENDING_STATUS,
        model: opts.requestedModel ?? null,
        caller_attribution: opts.callerAttribution ?? null,
        request_headers: opts.requestHeaders ?? null,
      },
      false,
    );
  }

  /** Insert the Attempt as pending at the provider-call boundary. */
  async recordPendingProviderAttempt(
    ctx: IngestionContext,
    requestId: string,
    attempt: ProviderAttemptRef,
    start: ProviderAttemptStart,
  ): Promise<boolean> {
    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      start.provider,
      start.model,
    );
    await this.messageRepo.insert(
      buildMessageRow(ctx, {
        id: attempt.id,
        request_id: requestId,
        attempt_number: attempt.attemptNumber,
        timestamp: attempt.startedAt,
        status: PENDING_STATUS,
        model: canonical.model,
        provider: canonical.provider,
        auth_type: start.authType ?? null,
        tenant_provider_id: start.tenantProviderId ?? null,
      }),
    );
    return true;
  }

  /** Complete an intermediate provider call that is retried below the proxy layer. */
  async completePendingProviderFailure(
    attempt: ProviderAttemptRef,
    status: number,
    errorBody: string,
    superseded: boolean,
  ): Promise<void> {
    if (!(await attempt.pendingWrite.catch(() => false))) return;
    const richStatus = superseded ? 'fallback_error' : status === 429 ? 'rate_limited' : 'error';
    const classified = classifyRow({
      status: richStatus,
      error_http_status: status,
    });
    await this.messageRepo.update(
      { id: attempt.id },
      {
        status: normalizeStatus(richStatus),
        error_message: scrubSecrets(errorBody).slice(0, 2000),
        error_http_status: status,
        duration_ms: Math.max(0, (attempt.completedAtMs ?? Date.now()) - attempt.startedAtMs),
        ...classified,
      },
    );
  }

  async recordProviderError(
    ctx: IngestionContext,
    httpStatus: number,
    errorMessage: string,
    opts?: ProviderErrorOpts,
  ): Promise<void> {
    const {
      requestId = uuid(),
      attemptNumber,
      attempt,
      skipAttempt = false,
      requestDurationMs,
      model,
      provider,
      tier,
      traceId,
      fallbackFromModel,
      fallbackIndex,
      authType,
      reason,
      specificityCategory,
      providerKeyLabel,
      tenantProviderId,
      callerAttribution,
      requestHeaders,
      requestParams,
      headerTierId,
      headerTierName,
      headerTierColor,
      autofix,
    } = opts ?? {};
    // A real Auto-fix retry must never disappear behind the generic 429
    // deduplication window; it is required to complete the linked attempt story.
    if (
      httpStatus === 429 &&
      !attempt &&
      !skipAttempt &&
      !getAutofixRetry(autofix) &&
      this.shouldSkipRateLimitRecord(ctx)
    ) {
      return;
    }

    const messageStatus = httpStatus === 429 ? 'rate_limited' : 'error';

    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      provider,
      model,
    );

    const row = buildMessageRow(ctx, {
      request_id: requestId,
      ...attemptIdentity(attempt, attemptNumber),
      trace_id: traceId ?? null,
      timestamp: new Date().toISOString(),
      duration_ms: requestDurationMs ?? null,
      status: messageStatus,
      error_message: scrubSecrets(normalizeProviderErrorForStorage(httpStatus, errorMessage)).slice(
        0,
        2000,
      ),
      error_http_status: httpStatus,
      ...autofixColumns(autofix, terminalAutofixRole(autofix)),
      model: canonical.model,
      provider: canonical.provider,
      routing_tier: tier ?? null,
      routing_reason: reason ?? null,
      fallback_from_model: fallbackFromModel ?? null,
      fallback_index: fallbackIndex ?? null,
      auth_type: authType ?? null,
      specificity_category: specificityCategory ?? null,
      provider_key_label: providerKeyLabel ?? null,
      tenant_provider_id: tenantProviderId ?? null,
      caller_attribution: callerAttribution ?? null,
      request_headers: requestHeaders ?? null,
      request_params: requestParams ?? null,
      header_tier_id: headerTierId ?? null,
      header_tier_name: headerTierName ?? null,
      header_tier_color: headerTierColor ?? null,
    });
    await this.persistRequest(ctx, requestId, row, true, autofix);
    if (!skipAttempt) await this.persistAttempt(row, attempt);
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
  }

  /**
   * The single writer for every Manifest-authored failure row: setup errors
   * (M100/M101), limits (M200/M204), rate limits (M201–M203), malformed requests
   * (M300), internal errors (M500), and expired keys (M004).
   *
   * `provider` and `routing_tier` are deliberately left NULL — no provider was
   * contacted and no tier was chosen. (The old canned-stub path wrote a
   * placeholder `provider='manifest'` / `routing_tier='simple'`, which put a
   * meaningless SIMPLE badge on setup errors and a phantom "manifest" entry in
   * the Messages provider dropdown.) `model` keeps the model the caller asked
   * for, which is real information.
   */
  async recordManifestBlockedRequest(
    ctx: IngestionContext,
    opts: ManifestBlockedRequestOpts,
  ): Promise<void> {
    const {
      requestId = uuid(),
      httpStatus,
      errorMessage,
      errorCode,
      reason,
      model,
      traceId,
      sessionKey,
      callerAttribution,
      requestHeaders,
      durationMs,
    } = opts;

    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      null,
      model ?? null,
    );

    const row = buildMessageRow(ctx, {
      trace_id: traceId ?? null,
      session_key: sessionKey ?? null,
      timestamp: new Date().toISOString(),
      duration_ms: durationMs ?? null,
      status: httpStatus === 429 ? 'rate_limited' : 'error',
      error_message: scrubSecrets(errorMessage).slice(0, 2000),
      error_code: errorCode ?? null,
      error_http_status: httpStatus ?? null,
      model: canonical.model,
      provider: null,
      routing_tier: null,
      routing_reason: reason,
      fallback_from_model: null,
      fallback_index: null,
      auth_type: null,
      specificity_category: null,
      provider_key_label: null,
      tenant_provider_id: null,
      caller_attribution: callerAttribution ?? null,
      request_headers: requestHeaders ?? null,
      request_params: null,
      header_tier_id: null,
      header_tier_name: null,
      header_tier_color: null,
    });
    // A Manifest-level rejection is a real request with zero provider attempts.
    const wroteRequest = await this.persistRequest(ctx, requestId, row, true);
    // Legacy unit-test doubles have no request repository. Keep their observed
    // write shape without affecting the production zero-attempt model.
    if (!wroteRequest) await this.messageRepo.insert(row);
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
  }

  async recordFailedFallbacks(
    ctx: IngestionContext,
    tier: string,
    primaryModel: string,
    failures: FailedFallback[],
    opts?: {
      traceId?: string;
      requestId?: string;
      firstAttemptNumber?: number;
      baseTimeMs?: number;
      markHandled?: boolean;
      lastAsError?: boolean;
      authType?: string;
      reason?: string;
      callerAttribution?: CallerAttribution | null;
      requestHeaders?: Record<string, string> | null;
      requestParams?: RequestParamDefaults | null;
      headerTierId?: string | null;
      headerTierName?: string | null;
      headerTierColor?: string | null;
    },
  ): Promise<void> {
    const {
      traceId,
      requestId = uuid(),
      firstAttemptNumber,
      baseTimeMs,
      markHandled = false,
      lastAsError = false,
      authType,
      reason,
      callerAttribution,
      requestHeaders,
      requestParams,
      headerTierId,
      headerTierName,
      headerTierColor,
    } = opts ?? {};
    failures = failures.filter((failure) => failure.providerCallStarted !== false);
    if (failures.length === 0) return;
    // primaryModel is loop-invariant — canonicalize once.
    const canonicalPrimary = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      null,
      primaryModel,
    );
    const canonicalFailures = await Promise.all(
      failures.map((f) =>
        this.customProviders.canonicalizeAgentMessageKeys(ctx.tenantId, f.provider, f.model),
      ),
    );
    const rows: Partial<AgentMessage>[] = [];
    for (let i = 0; i < failures.length; i++) {
      const f = failures[i];
      const ts = baseTimeMs
        ? new Date(baseTimeMs + (failures.length - i) * 100).toISOString()
        : new Date().toISOString();
      const isLast = i === failures.length - 1;
      const useHandledStatus = markHandled && !(lastAsError && isLast);
      const status = useHandledStatus
        ? 'fallback_error'
        : f.status === 429
          ? 'rate_limited'
          : 'error';
      const canonical = canonicalFailures[i];
      // Prefer the per-failure auth_type when the proxy was able to record
      // it (fallback came from a structured ModelRoute, or the legacy
      // inference path tried a different credential than the primary).
      // Falling back to the primary auth keeps behavior identical for rows
      // that haven't been backfilled with routes.
      const recordedAuth = f.authType ?? authType ?? null;
      rows.push(
        buildMessageRow(ctx, {
          request_id: requestId,
          ...attemptIdentity(
            f.attempt,
            firstAttemptNumber == null ? undefined : firstAttemptNumber + i,
          ),
          trace_id: traceId ?? null,
          timestamp: ts,
          status,
          error_message: scrubSecrets(
            normalizeProviderErrorForStorage(f.status, f.errorBody),
          ).slice(0, 2000),
          error_http_status: f.status,
          model: canonical.model,
          provider: canonical.provider,
          routing_tier: tier,
          routing_reason: reason ?? null,
          fallback_from_model: canonicalPrimary.model,
          fallback_index: f.fallbackIndex,
          auth_type: recordedAuth,
          // Per-failure connection: each failed fallback carries its own key id.
          tenant_provider_id: f.tenantProviderId ?? null,
          caller_attribution: callerAttribution ?? null,
          request_headers: requestHeaders ?? null,
          request_params: requestParams ?? null,
          header_tier_id: headerTierId ?? null,
          header_tier_name: headerTierName ?? null,
          header_tier_color: headerTierColor ?? null,
        }),
      );
    }
    // Fallback attempts never define the caller-visible outcome themselves.
    // Exhausted chains persist the rebuilt primary response as the terminal
    // parent in recordPrimaryFailure; recovered chains finish on success.
    await this.persistRequest(ctx, requestId, rows[rows.length - 1], false);
    if (failures.every((failure) => !failure.attempt)) {
      await this.messageRepo.insert(rows);
    } else {
      await Promise.all(
        rows.map((row, index) => this.persistAttempt(row, failures[index].attempt)),
      );
    }
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
  }

  async recordPrimaryFailure(
    ctx: IngestionContext,
    tier: string,
    model: string,
    errorBody: string,
    timestamp: string,
    authType?: string,
    opts?: {
      provider?: string;
      requestId?: string;
      attemptNumber?: number;
      attempt?: ProviderAttemptRef;
      /** Finish/update the Request without creating a Provider Attempt. */
      skipAttempt?: boolean;
      requestDurationMs?: number;
      reason?: string;
      tenantProviderId?: string | null;
      callerAttribution?: CallerAttribution | null;
      requestHeaders?: Record<string, string> | null;
      requestParams?: RequestParamDefaults | null;
      headerTierId?: string | null;
      headerTierName?: string | null;
      headerTierColor?: string | null;
      /** Provider status for the superseded primary or failed Auto-fix retry. */
      httpStatus?: number | null;
      /**
       * Auto-fix audit when this superseded primary was also an Auto-fix
       * attempt. Stamped onto THIS row (not a separate `auto_fixed` row) so a
       * heal-then-fallback flow records the primary failure exactly once.
       */
      autofix?: AutofixRecord;
      /** HTTP status returned to the caller when every fallback was exhausted. */
      terminalHttpStatus?: number;
    },
  ): Promise<void> {
    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      opts?.provider,
      model,
    );
    const requestId = opts?.requestId ?? uuid();
    const row = buildMessageRow(ctx, {
      request_id: requestId,
      ...attemptIdentity(opts?.attempt, opts?.attemptNumber),
      timestamp,
      duration_ms: opts?.requestDurationMs ?? null,
      status: 'fallback_error',
      ...autofixColumns(opts?.autofix, terminalAutofixRole(opts?.autofix)),
      error_message: scrubSecrets(
        normalizeProviderErrorForStorage(opts?.httpStatus, errorBody),
      ).slice(0, 2000),
      error_http_status: opts?.httpStatus ?? null,
      model: canonical.model,
      provider: canonical.provider,
      routing_tier: tier,
      routing_reason: opts?.reason ?? null,
      fallback_from_model: null,
      fallback_index: null,
      auth_type: authType ?? null,
      tenant_provider_id: opts?.tenantProviderId ?? null,
      caller_attribution: opts?.callerAttribution ?? null,
      request_headers: opts?.requestHeaders ?? null,
      request_params: opts?.requestParams ?? null,
      header_tier_id: opts?.headerTierId ?? null,
      header_tier_name: opts?.headerTierName ?? null,
      header_tier_color: opts?.headerTierColor ?? null,
    });
    const requestOutcome = opts?.terminalHttpStatus
      ? {
          ...row,
          status: opts.terminalHttpStatus === 429 ? 'rate_limited' : 'error',
          error_http_status: opts.terminalHttpStatus,
        }
      : row;
    await this.persistRequest(
      ctx,
      requestId,
      requestOutcome,
      Boolean(opts?.terminalHttpStatus),
      opts?.autofix,
    );
    if (!opts?.skipAttempt) await this.persistAttempt(row, opts?.attempt);
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
  }

  async recordFallbackSuccess(
    ctx: IngestionContext,
    model: string,
    tier: string,
    opts?: FallbackSuccessOpts,
  ): Promise<void> {
    const {
      requestId = uuid(),
      attemptNumber,
      attempt,
      requestDurationMs,
      traceId,
      provider,
      fallbackFromModel,
      fallbackIndex,
      timestamp,
      authType,
      reason,
      providerKeyLabel,
      tenantProviderId,
      usage,
      callerAttribution,
      requestHeaders,
      requestParams,
      headerTierId,
      headerTierName,
      headerTierColor,
      autofix,
    } = opts ?? {};

    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    const costUsd = computeTokenCost({
      inputTokens,
      outputTokens,
      cacheReadTokens: usage?.cache_read_tokens ?? 0,
      cacheCreationTokens: usage?.cache_creation_tokens ?? 0,
      model,
      pricing: usage ? this.pricingCache.getByModel(model) : undefined,
      isSubscription: authType === 'subscription',
      perRequestCostUsd: await this.perRequestSubscriptionCost(provider, authType, model),
      reportedCostUsd: usage?.reported_cost_usd,
    });

    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      provider,
      model,
    );
    const canonicalFallbackFrom = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      null,
      fallbackFromModel,
    );

    const row = buildMessageRow(ctx, {
      request_id: requestId,
      ...attemptIdentity(attempt, attemptNumber),
      trace_id: traceId ?? null,
      timestamp: timestamp ?? new Date().toISOString(),
      duration_ms: requestDurationMs ?? null,
      status: 'ok',
      model: canonical.model,
      provider: canonical.provider,
      routing_tier: tier,
      routing_reason: reason ?? null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: usage?.cache_read_tokens ?? 0,
      cache_creation_tokens: usage?.cache_creation_tokens ?? 0,
      cost_usd: costUsd,
      auth_type: authType ?? null,
      fallback_from_model: canonicalFallbackFrom.model,
      fallback_index: fallbackIndex ?? null,
      provider_key_label: providerKeyLabel ?? null,
      tenant_provider_id: tenantProviderId ?? null,
      caller_attribution: callerAttribution ?? null,
      request_headers: requestHeaders ?? null,
      request_params: requestParams ?? null,
      header_tier_id: headerTierId ?? null,
      header_tier_name: headerTierName ?? null,
      header_tier_color: headerTierColor ?? null,
    });
    await this.persistRequest(ctx, requestId, row, true, autofix);
    await this.persistAttempt(row, attempt);
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
  }

  async recordSuccessMessage(
    ctx: IngestionContext,
    model: string,
    tier: string,
    reason: string,
    usage: StreamUsage,
    opts?: SuccessMessageOpts,
  ): Promise<void> {
    const {
      requestId: providedRequestId,
      attemptNumber,
      attempt,
      traceId,
      provider,
      authType,
      sessionKey,
      durationMs,
      specificityCategory,
      providerKeyLabel,
      tenantProviderId,
      callerAttribution,
      requestHeaders,
      requestParams,
      headerTierId,
      headerTierName,
      headerTierColor,
      autofix,
    } = opts ?? {};
    const requestId = providedRequestId ?? uuid();

    const costUsd = computeTokenCost({
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cacheReadTokens: usage.cache_read_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_tokens ?? 0,
      model,
      pricing: this.pricingCache.getByModel(model),
      isSubscription: authType === 'subscription',
      perRequestCostUsd: await this.perRequestSubscriptionCost(provider, authType, model),
      reportedCostUsd: usage.reported_cost_usd,
    });

    // `model` is a required string, so the overload on
    // `canonicalizeAgentMessageKeys` keeps `canonical.model` non-null.
    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      provider,
      model,
    );
    const canonicalModel = canonical.model;
    const canonicalProvider = canonical.provider;

    const normalizedSessionKey = this.dedup.normalizeSessionKey(sessionKey);

    // Manifest's own canned stubs never reach here — the controller routes them
    // to recordManifestBlockedRequest, which is the sole writer of Manifest rows.
    const status = 'ok';
    const errorMessage = null;

    const requestRow = buildMessageRow(ctx, {
      request_id: requestId,
      ...attemptIdentity(attempt, attemptNumber),
      trace_id: traceId ?? null,
      session_key: normalizedSessionKey,
      timestamp: new Date().toISOString(),
      status,
      error_message: errorMessage,
      model: canonicalModel,
      provider: canonicalProvider,
      routing_tier: tier,
      routing_reason: reason,
      duration_ms: durationMs ?? null,
      caller_attribution: callerAttribution ?? null,
      request_headers: requestHeaders ?? null,
      request_params: requestParams ?? null,
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
      cache_read_tokens: usage.cache_read_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_tokens ?? 0,
      cost_usd: costUsd,
      auth_type: authType ?? null,
      specificity_category: specificityCategory ?? null,
      provider_key_label: providerKeyLabel ?? null,
      tenant_provider_id: tenantProviderId ?? null,
      header_tier_id: headerTierId ?? null,
      header_tier_name: headerTierName ?? null,
      header_tier_color: headerTierColor ?? null,
      ...autofixColumns(autofix, 'retry'),
    });
    await this.persistRequest(ctx, requestId, requestRow, true, autofix);

    if (attempt) {
      await this.persistAttempt(requestRow, attempt);
      this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
      return;
    }

    let wrote = false;
    await this.dedup.withSuccessWriteLock(
      this.dedup.getSuccessWriteLockKey(
        ctx,
        canonicalModel,
        traceId,
        normalizedSessionKey,
        providedRequestId,
      ),
      async () => {
        await this.dedup.withAgentMessageTransaction(this.messageRepo, ctx, async (messageRepo) => {
          const existing = await this.dedup.findExistingSuccessMessage(
            messageRepo,
            ctx,
            canonicalModel,
            usage,
            traceId,
            normalizedSessionKey,
            providedRequestId,
          );

          if (existing) {
            const hasRecordedTokens =
              (existing.input_tokens ?? 0) > 0 || (existing.output_tokens ?? 0) > 0;
            if (hasRecordedTokens) return;

            const updatePayload: Partial<AgentMessage> = {
              request_id: requestId,
              attempt_number: attemptNumber ?? null,
              status,
              ...autofixColumns(autofix, 'retry'),
              error_message: errorMessage,
              model: canonicalModel,
              provider: canonicalProvider,
              routing_tier: tier,
              routing_reason: reason,
              input_tokens: usage.prompt_tokens,
              output_tokens: usage.completion_tokens,
              cache_read_tokens: usage.cache_read_tokens ?? 0,
              cache_creation_tokens: usage.cache_creation_tokens ?? 0,
              cost_usd: costUsd,
              auth_type: authType ?? null,
              user_id: ctx.userId,
              duration_ms: durationMs ?? null,
              specificity_category: specificityCategory ?? null,
              provider_key_label: providerKeyLabel ?? null,
              tenant_provider_id: tenantProviderId ?? null,
              caller_attribution: callerAttribution ?? null,
              request_headers: requestHeaders ?? null,
              request_params: requestParams ?? null,
              header_tier_id: headerTierId ?? null,
              header_tier_name: headerTierName ?? null,
              header_tier_color: headerTierColor ?? null,
            };
            if (normalizedSessionKey) updatePayload.session_key = normalizedSessionKey;
            // This update path bypasses buildMessageRow, so classify inline to
            // keep every write site stamping the same orthogonal error axes.
            Object.assign(updatePayload, classifyRow(updatePayload));
            updatePayload.status = normalizeStatus(updatePayload.status);

            await messageRepo.update({ id: existing.id }, updatePayload);
            wrote = true;
            return;
          }

          const newId = uuid();
          await messageRepo.insert(
            buildMessageRow(ctx, {
              id: newId,
              request_id: requestId,
              attempt_number: attemptNumber ?? null,
              ...autofixColumns(autofix, 'retry'),
              trace_id: traceId ?? null,
              session_key: normalizedSessionKey,
              timestamp: new Date().toISOString(),
              status,
              error_message: errorMessage,
              model: canonicalModel,
              provider: canonicalProvider,
              routing_tier: tier,
              routing_reason: reason,
              input_tokens: usage.prompt_tokens,
              output_tokens: usage.completion_tokens,
              cache_read_tokens: usage.cache_read_tokens ?? 0,
              cache_creation_tokens: usage.cache_creation_tokens ?? 0,
              cost_usd: costUsd,
              auth_type: authType ?? null,
              fallback_from_model: null,
              fallback_index: null,
              duration_ms: durationMs ?? null,
              specificity_category: specificityCategory ?? null,
              provider_key_label: providerKeyLabel ?? null,
              tenant_provider_id: tenantProviderId ?? null,
              caller_attribution: callerAttribution ?? null,
              request_headers: requestHeaders ?? null,
              request_params: requestParams ?? null,
              header_tier_id: headerTierId ?? null,
              header_tier_name: headerTierName ?? null,
              header_tier_color: headerTierColor ?? null,
            }),
          );
          wrote = true;
        });
      },
    );
    if (wrote) {
      this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
    }
  }

  /**
   * Record the failed original request of an Auto-fix flow as its own row,
   * linked to the successful or failed retry via `autofix.groupId`.
   */
  async recordAutofixOriginal(
    ctx: IngestionContext,
    model: string,
    tier: string,
    autofix: AutofixRecord,
    opts?: AutofixOriginalOpts,
  ): Promise<void> {
    if (!getAutofixRetry(autofix)) return;
    const original = autofix.chain.find((entry) => entry.origin === 'original' && entry.error);
    if (!original?.error) return;

    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      opts?.provider,
      model,
    );
    const requestId = opts?.requestId ?? uuid();
    const row = buildMessageRow(ctx, {
      request_id: requestId,
      ...attemptIdentity(opts?.attempt, opts?.attemptNumber),
      trace_id: opts?.traceId ?? null,
      timestamp: new Date(Date.now() - 1000).toISOString(),
      status: 'auto_fixed',
      // The full `{"error":{…}}` envelope, like every other error row — storing the
      // bare message would drop the `type`/`param`/`code` that identify the error
      // downstream (see serializeProviderError).
      error_message: serializeProviderError(original.error),
      error_http_status: original.http_status,
      model: canonical.model,
      provider: canonical.provider,
      routing_tier: tier ?? null,
      routing_reason: opts?.reason ?? null,
      auth_type: opts?.authType ?? null,
      specificity_category: opts?.specificityCategory ?? null,
      provider_key_label: opts?.providerKeyLabel ?? null,
      tenant_provider_id: opts?.tenantProviderId ?? null,
      caller_attribution: opts?.callerAttribution ?? null,
      request_headers: opts?.requestHeaders ?? null,
      request_params: opts?.requestParams ?? null,
      header_tier_id: opts?.headerTierId ?? null,
      header_tier_name: opts?.headerTierName ?? null,
      header_tier_color: opts?.headerTierColor ?? null,
      autofix_applied: true,
      autofix_group_id: autofix.groupId,
      autofix_role: 'original',
      autofix_operations: (original.operations as object | null) ?? null,
      autofix_decision: buildAutofixDecision(original),
    });
    await this.persistRequest(ctx, requestId, row, false, autofix);
    await this.persistAttempt(row, opts?.attempt);
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
  }

  /**
   * Resolve the per-request USD cost for subscription providers that bill
   * against a dollar quota (today: OpenCode Go). Returns `null` for every
   * other provider, leaving the existing "subscription → $0" path intact.
   * Canonicalizes the provider through the registry so aliases (e.g.
   * `opencodego`, `OpenCode-Go`) resolve identically. Awaits the catalog
   * `list()` once if its in-memory index is still cold so the first request
   * after a process restart doesn't undercount as $0.
   */
  private async perRequestSubscriptionCost(
    provider: string | null | undefined,
    authType: string | null | undefined,
    model: string | null | undefined,
  ): Promise<number | null> {
    if (authType !== 'subscription') return null;
    if (!provider) return null;
    const canonical = PROVIDER_BY_ID_OR_ALIAS.get(provider.toLowerCase())?.id;
    if (canonical !== 'opencode-go') return null;
    return this.opencodeGoCatalog.resolveCostPerRequest(model);
  }

  private evictExpiredCooldowns(): void {
    const now = Date.now();
    for (const [k, v] of this.rateLimitCooldown) {
      if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
    }
  }
}
