import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Agent } from '../../../entities/agent.entity';
import { Tenant } from '../../../entities/tenant.entity';
import type { ForwardResult } from '../../proxy/provider-client';
import { AutofixService, type MaybeHealParams } from '../autofix.service';
import { HealContractError, type HealingClient } from '../healing-client';
import type { HealResponse } from '../phoenix.types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a ForwardResult around the global (undici) Response, all flags false. */
function makeForward(body: string, status: number): ForwardResult {
  return {
    response: new Response(body, { status }),
    isGoogle: false,
    isAnthropic: false,
    isChatGpt: false,
    isResponses: false,
    isCodeAssist: false,
  };
}

type HealingClientMock = {
  heal: jest.Mock<Promise<HealResponse>, [unknown]>;
  reportOutcome: jest.Mock;
};

function makeHealingClient(): HealingClientMock {
  return {
    heal: jest.fn(),
    reportOutcome: jest.fn().mockResolvedValue(null),
  };
}

/** ConfigService stub whose `get` reads from a plain map (undefined by default). */
function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => overrides[key]),
  } as unknown as ConfigService;
}

function makeAgentRepo(findOneImpl?: () => unknown): {
  repo: Repository<Agent>;
  findOne: jest.Mock;
} {
  const findOne = jest.fn(findOneImpl ?? (() => null));
  return { repo: { findOne } as unknown as Repository<Agent>, findOne };
}

/**
 * Tenant repo mock for the early-access gate. Default: the tenant is explicitly
 * GRANTED (`autofix_access_granted_at` set), which unlocks Auto-fix in every
 * rollout phase — so the heal-path tests below proceed regardless of phase.
 * Override to deny, e.g. `() => ({ autofix_access_granted_at: null, autofix_waitlist_at: null })`.
 */
function makeTenantRepo(findOneImpl?: () => unknown): {
  repo: Repository<Tenant>;
  findOne: jest.Mock;
} {
  const findOne = jest.fn(
    findOneImpl ??
      (() => ({ autofix_access_granted_at: '2026-01-01T00:00:00Z', autofix_waitlist_at: null })),
  );
  return { repo: { findOne } as unknown as Repository<Tenant>, findOne };
}

function makeService(opts: {
  client?: HealingClient;
  repo?: Repository<Agent>;
  tenantRepo?: Repository<Tenant>;
  config?: ConfigService;
}): AutofixService {
  return new AutofixService(
    opts.client ?? (makeHealingClient() as unknown as HealingClient),
    opts.repo ?? makeAgentRepo().repo,
    opts.tenantRepo ?? makeTenantRepo().repo,
    opts.config ?? makeConfig(),
  );
}

/** Base params for maybeHeal; individual tests override `forward` / `reforward`. */
function makeParams(overrides: Partial<MaybeHealParams>): MaybeHealParams {
  return {
    forward: makeForward('{"error":{"message":"boom"}}', 400),
    agentId: 'agent-1',
    tenantId: 'tenant-1',
    provider: 'anthropic',
    apiMode: 'chat_completions',
    requestBody: { model: 'gpt', max_tokens: 100 },
    url: 'https://api.example.com/v1/chat/completions',
    reforward: jest.fn(),
    ...overrides,
  } as MaybeHealParams;
}

const patchedHeal = (over: Partial<HealResponse> = {}): HealResponse => ({
  status: 'patched',
  issueId: 'issue-1',
  patchId: 'patch-1',
  healAttemptId: 'heal-1',
  operations: [{ type: 'rename_param', from: 'max_tokens', to: 'max_output_tokens' }],
  explanation: {
    summary: 'Renamed the "max_tokens" parameter to "max_output_tokens".',
    operations: [
      {
        type: 'rename_param',
        detail: 'Renamed the "max_tokens" parameter to "max_output_tokens".',
      },
    ],
    source: 'deterministic',
  },
  healedBody: { model: 'gpt', max_output_tokens: 100 },
  ...over,
});

/**
 * A `reforward` mock that returns a FRESH ForwardResult on every call. Reusing a
 * single Response fails: the service reads the retry body (`.text()`), so a
 * shared Response would be "already read" on a later access.
 */
function reforwardMock(
  body: string,
  status: number,
): jest.Mock<Promise<ForwardResult>, [Record<string, unknown>]> {
  return jest.fn((_healedBody: Record<string, unknown>) =>
    Promise.resolve(makeForward(body, status)),
  );
}

/** Yield to the microtask queue so fire-and-forget `.catch` handlers run. */
const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------------------

describe('AutofixService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Constructor config parsing
  // -------------------------------------------------------------------------
  describe('constructor config parsing', () => {
    it('defaults globalEnabled to true when AUTOFIX_GLOBAL_ENABLED is unset', () => {
      const { findOne } = makeAgentRepo();
      const service = makeService({ config: makeConfig() });
      // Directly assert the parsed default (only `'false'` disables), and that
      // construction never touches the DB.
      expect((service as unknown as { globalEnabled: boolean }).globalEnabled).toBe(true);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // resolveEnabled — deployment-mode default when autofix_enabled is NULL
  // -------------------------------------------------------------------------
  describe('resolveEnabled (deployment-mode default)', () => {
    let savedMode: string | undefined;
    beforeEach(() => {
      savedMode = process.env.MANIFEST_MODE;
    });
    afterEach(() => {
      if (savedMode === undefined) delete process.env.MANIFEST_MODE;
      else process.env.MANIFEST_MODE = savedMode;
    });

    it('an explicit true/false overrides the mode default', () => {
      process.env.MANIFEST_MODE = 'selfhosted';
      const service = makeService({});
      expect(service.resolveEnabled(true)).toBe(true);
      expect(service.resolveEnabled(false)).toBe(false);
    });

    it('a NULL/undefined flag inherits ON in cloud mode', () => {
      process.env.MANIFEST_MODE = 'cloud';
      const service = makeService({});
      expect(service.resolveEnabled(null)).toBe(true);
      expect(service.resolveEnabled(undefined)).toBe(true);
    });

    it('a NULL flag inherits OFF in self-hosted mode', () => {
      process.env.MANIFEST_MODE = 'selfhosted';
      const service = makeService({});
      expect(service.resolveEnabled(null)).toBe(false);
    });

    it('heals an unset agent in cloud (NULL → default ON)', async () => {
      process.env.MANIFEST_MODE = 'cloud';
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      const reforward = jest.fn().mockResolvedValue(makeForward('{"ok":true}', 200));
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: null }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result!.record.outcome).toBe('healed');
      expect(client.heal).toHaveBeenCalled();
    });

    it('skips an unset agent in self-hosted (NULL → default OFF)', async () => {
      process.env.MANIFEST_MODE = 'selfhosted';
      const client = makeHealingClient();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: null }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({}));

      expect(result).toBeNull();
      expect(client.heal).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // isRepairable / parseStatuses
  // -------------------------------------------------------------------------
  describe('isRepairable', () => {
    it('uses the default 400/404/422 set when config is unset', () => {
      const service = makeService({ config: makeConfig() });
      expect(service.isRepairable(400)).toBe(true);
      expect(service.isRepairable(404)).toBe(true);
      expect(service.isRepairable(422)).toBe(true);
      expect(service.isRepairable(500)).toBe(false);
      expect(service.isRepairable(401)).toBe(false);
    });

    it('honours a custom AUTOFIX_REPAIRABLE_STATUSES so 422 becomes non-repairable', () => {
      const service = makeService({
        config: makeConfig({ AUTOFIX_REPAIRABLE_STATUSES: '400,404' }),
      });
      expect(service.isRepairable(400)).toBe(true);
      expect(service.isRepairable(404)).toBe(true);
      expect(service.isRepairable(422)).toBe(false);
    });

    it('falls back to defaults for empty / whitespace config', () => {
      const service = makeService({ config: makeConfig({ AUTOFIX_REPAIRABLE_STATUSES: '   ' }) });
      expect(service.isRepairable(400)).toBe(true);
      expect(service.isRepairable(404)).toBe(true);
      expect(service.isRepairable(422)).toBe(true);
    });

    it('falls back to defaults when every entry is garbage / out of range', () => {
      // Non-numeric and out-of-[400,500) entries are all filtered out, so the
      // parsed set is empty → the DEFAULT set is used.
      const service = makeService({
        config: makeConfig({ AUTOFIX_REPAIRABLE_STATUSES: 'abc,200,500,600' }),
      });
      expect(service.isRepairable(400)).toBe(true);
      expect(service.isRepairable(404)).toBe(true);
      expect(service.isRepairable(422)).toBe(true);
      expect(service.isRepairable(200)).toBe(false);
      expect(service.isRepairable(500)).toBe(false);
    });

    it('keeps only in-range entries and drops out-of-range ones', () => {
      // 429 is a valid 4xx and kept; 500/399 are filtered out.
      const service = makeService({
        config: makeConfig({ AUTOFIX_REPAIRABLE_STATUSES: '429,500,399' }),
      });
      expect(service.isRepairable(429)).toBe(true);
      expect(service.isRepairable(500)).toBe(false);
      expect(service.isRepairable(399)).toBe(false);
      // Default 400 is NOT present because a non-empty valid set replaced defaults.
      expect(service.isRepairable(400)).toBe(false);
    });

    it('rejects a numeric-prefixed token (404abc) that parseInt would misread as 404', () => {
      // Old code used bare parseInt, which accepts '404abc' as 404; the digits-only
      // filter drops it, so only the clean 422 survives.
      const service = makeService({
        config: makeConfig({ AUTOFIX_REPAIRABLE_STATUSES: '404abc,422' }),
      });
      expect(service.isRepairable(404)).toBe(false);
      expect(service.isRepairable(422)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // hasAccess — three-phase rollout gate (AUTOFIX_ROLLOUT)
  // -------------------------------------------------------------------------
  const granted = (over: Record<string, unknown> = {}) => ({
    autofix_access_granted_at: '2026-02-01',
    autofix_waitlist_at: null,
    ...over,
  });
  const joinedOnly = () => ({ autofix_access_granted_at: null, autofix_waitlist_at: '2026-02-01' });
  const neither = () => ({ autofix_access_granted_at: null, autofix_waitlist_at: null });

  describe('hasAccess three-phase gate', () => {
    it('everyone phase: grants any tenant with no DB read', async () => {
      const { repo: tenantRepo, findOne } = makeTenantRepo(neither);
      const service = makeService({
        tenantRepo,
        config: makeConfig({ AUTOFIX_ROLLOUT: 'everyone' }),
      });
      expect(await service.hasAccess('t1')).toBe(true);
      expect(findOne).not.toHaveBeenCalled();
    });

    it('denies a null tenant (no context) in every phase', async () => {
      const service = makeService({ config: makeConfig({ AUTOFIX_ROLLOUT: 'everyone' }) });
      expect(await service.hasAccess(null)).toBe(false);
    });

    // Phase 1 — selected (default)
    it('selected phase: grants a hand-picked (granted) tenant', async () => {
      const service = makeService({ tenantRepo: makeTenantRepo(granted).repo });
      expect(await service.hasAccess('t1')).toBe(true);
    });

    it('selected phase: denies a tenant that only joined the waitlist', async () => {
      const service = makeService({ tenantRepo: makeTenantRepo(joinedOnly).repo });
      expect(await service.hasAccess('t1')).toBe(false);
    });

    it('selected phase: denies a tenant with neither grant nor waitlist', async () => {
      const service = makeService({ tenantRepo: makeTenantRepo(neither).repo });
      expect(await service.hasAccess('t1')).toBe(false);
    });

    it('selected phase: denies an unknown tenant row', async () => {
      const service = makeService({ tenantRepo: makeTenantRepo(() => null).repo });
      expect(await service.hasAccess('t1')).toBe(false);
    });

    // Phase 2 — waitlist
    it('waitlist phase: grants a tenant that joined the waitlist', async () => {
      const service = makeService({
        tenantRepo: makeTenantRepo(joinedOnly).repo,
        config: makeConfig({ AUTOFIX_ROLLOUT: 'waitlist' }),
      });
      expect(await service.hasAccess('t1')).toBe(true);
    });

    it('waitlist phase: still grants a hand-picked tenant that never joined', async () => {
      const service = makeService({
        tenantRepo: makeTenantRepo(granted).repo,
        config: makeConfig({ AUTOFIX_ROLLOUT: 'waitlist' }),
      });
      expect(await service.hasAccess('t1')).toBe(true);
    });

    it('waitlist phase: denies a tenant with neither', async () => {
      const service = makeService({
        tenantRepo: makeTenantRepo(neither).repo,
        config: makeConfig({ AUTOFIX_ROLLOUT: 'waitlist' }),
      });
      expect(await service.hasAccess('t1')).toBe(false);
    });

    it('treats an unknown AUTOFIX_ROLLOUT value as the default "selected" phase', async () => {
      // Invalid → parseRollout falls back to `selected`, so waitlist alone is denied.
      const service = makeService({
        tenantRepo: makeTenantRepo(joinedOnly).repo,
        config: makeConfig({ AUTOFIX_ROLLOUT: 'bogus' }),
      });
      expect(await service.hasAccess('t1')).toBe(false);
    });

    it('caches the decision; invalidateAccess forces a fresh read', async () => {
      const { repo: tenantRepo, findOne } = makeTenantRepo(granted);
      const service = makeService({ tenantRepo });
      expect(await service.hasAccess('t1')).toBe(true);
      expect(await service.hasAccess('t1')).toBe(true);
      expect(findOne).toHaveBeenCalledTimes(1);
      service.invalidateAccess('t1');
      expect(await service.hasAccess('t1')).toBe(true);
      expect(findOne).toHaveBeenCalledTimes(2);
    });

    it('re-reads when the cached decision has expired', async () => {
      const { repo: tenantRepo, findOne } = makeTenantRepo(granted);
      const service = makeService({ tenantRepo });
      const cache = (
        service as unknown as { accessCache: Map<string, { value: boolean; expiresAt: number }> }
      ).accessCache;
      cache.set('t1', { value: false, expiresAt: Date.now() - 1 }); // already expired
      expect(await service.hasAccess('t1')).toBe(true);
      expect(findOne).toHaveBeenCalledTimes(1);
    });

    it('clears the access cache once it reaches the bound', async () => {
      const service = makeService({ tenantRepo: makeTenantRepo(granted).repo });
      const cache = (service as unknown as { accessCache: Map<string, unknown> }).accessCache;
      for (let i = 0; i < 5000; i += 1) {
        cache.set(`filler-${i}`, { value: true, expiresAt: Date.now() + 30_000 });
      }
      expect(cache.size).toBe(5000);
      await service.hasAccess('fresh-tenant');
      expect(cache.size).toBe(1);
      expect(cache.has('fresh-tenant')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — early-access gate (no heal for non-access tenants)
  // -------------------------------------------------------------------------
  describe('maybeHeal early-access gate', () => {
    it('returns null (never calls Phoenix) when the tenant lacks access', async () => {
      const client = makeHealingClient();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const { repo: tenantRepo } = makeTenantRepo(neither);
      const service = makeService({ client: client as unknown as HealingClient, repo, tenantRepo });

      const result = await service.maybeHeal(makeParams({}));

      expect(result).toBeNull();
      expect(client.heal).not.toHaveBeenCalled();
    });

    it('degrades to null (does not throw) when the access check rejects', async () => {
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const { repo: tenantRepo } = makeTenantRepo(() => {
        throw new Error('tenant db down');
      });
      // Silence the expected "autofix gate load failed" warning.
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({ repo, tenantRepo });

      await expect(service.maybeHeal(makeParams({}))).resolves.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — hot-path no-ops (no config load, no body read)
  // -------------------------------------------------------------------------
  describe('maybeHeal hot-path no-ops', () => {
    it('returns null and never loads config when the forward is ok', async () => {
      const { repo, findOne } = makeAgentRepo();
      const service = makeService({ repo });
      const forward = makeForward('ok', 200);

      const result = await service.maybeHeal(makeParams({ forward }));

      expect(result).toBeNull();
      expect(findOne).not.toHaveBeenCalled();
      // Body was never consumed.
      expect(forward.response.bodyUsed).toBe(false);
    });

    it('returns null when AUTOFIX_GLOBAL_ENABLED is "false"', async () => {
      const { repo, findOne } = makeAgentRepo();
      const service = makeService({
        repo,
        config: makeConfig({ AUTOFIX_GLOBAL_ENABLED: 'false' }),
      });
      const forward = makeForward('{"error":{"message":"boom"}}', 400);

      const result = await service.maybeHeal(makeParams({ forward }));

      expect(result).toBeNull();
      expect(findOne).not.toHaveBeenCalled();
      expect(forward.response.bodyUsed).toBe(false);
    });

    it('returns null for a non-repairable status without loading config or reading body', async () => {
      const { repo, findOne } = makeAgentRepo();
      const service = makeService({ repo });
      const forward = makeForward('server error', 500);

      const result = await service.maybeHeal(makeParams({ forward }));

      expect(result).toBeNull();
      expect(findOne).not.toHaveBeenCalled();
      expect(forward.response.bodyUsed).toBe(false);
    });

    it('returns null for a 401 (non-repairable) status', async () => {
      const { repo, findOne } = makeAgentRepo();
      const service = makeService({ repo });
      const forward = makeForward('unauthorized', 401);

      const result = await service.maybeHeal(makeParams({ forward }));

      expect(result).toBeNull();
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — agent config gating
  // -------------------------------------------------------------------------
  describe('maybeHeal agent config gating', () => {
    it('returns null when the agent row is not found', async () => {
      const { repo } = makeAgentRepo(() => null);
      const service = makeService({ repo });

      const result = await service.maybeHeal(makeParams({}));

      expect(result).toBeNull();
    });

    it('returns null when the agent has autofix disabled', async () => {
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: false }));
      const service = makeService({ repo });

      const result = await service.maybeHeal(makeParams({}));

      expect(result).toBeNull();
    });

    it('queries the agent scoped by id + tenant with the minimal column set', async () => {
      const { repo, findOne } = makeAgentRepo(() => null);
      const service = makeService({ repo });

      await service.maybeHeal(makeParams({ agentId: 'a-9', tenantId: 't-9' }));

      expect(findOne).toHaveBeenCalledWith({
        where: { id: 'a-9', tenant_id: 't-9' },
        select: ['autofix_enabled'],
      });
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — happy heal on the single attempt
  // -------------------------------------------------------------------------
  describe('maybeHeal happy path', () => {
    it('heals on the patched retry, reports the cleared retry, and records the chain', async () => {
      const client = makeHealingClient();
      const heal = patchedHeal();
      client.heal.mockResolvedValue(heal);
      const healedForward = makeForward('{"ok":true}', 200);
      const reforward = jest.fn().mockResolvedValue(healedForward);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result).not.toBeNull();
      expect(result!.record.outcome).toBe('healed');
      expect(result!.record.original_http_status).toBe(400);

      // Returned forward is the healed 200.
      expect(result!.forward).toBe(healedForward);
      expect(result!.forward.response.status).toBe(200);

      // reforward called once with Phoenix's healedBody.
      expect(reforward).toHaveBeenCalledTimes(1);
      expect(reforward).toHaveBeenCalledWith(heal.healedBody);

      // reportOutcome called once with the cleared 2xx retry status and no error.
      expect(client.reportOutcome).toHaveBeenCalledTimes(1);
      expect(client.reportOutcome).toHaveBeenCalledWith('heal-1', { retryStatusCode: 200 });
      // The success report carries no `error` key.
      expect(client.reportOutcome.mock.calls[0][1]).not.toHaveProperty('error');

      // Chain: original entry (attempt 0, with error + decision + patch_worked)
      // followed by the terminal autofix success entry (attempt 1, status 200, no error).
      const chain = result!.record.chain;
      expect(chain).toHaveLength(2);

      const original = chain[0];
      expect(original.attempt).toBe(0);
      expect(original.origin).toBe('original');
      expect(original.http_status).toBe(400);
      expect(original.error).toBeDefined();
      expect(original.error!.message).toBe('boom');
      expect(original.phoenix_status).toBe('patched');
      expect(original.issue_id).toBe('issue-1');
      expect(original.patch_id).toBe('patch-1');
      expect(original.heal_attempt_id).toBe('heal-1');
      expect(original.operations).toEqual(heal.operations);
      // Phoenix's human-readable "why" rides the same entry, for the recorder to persist.
      expect(original.explanation).toEqual(heal.explanation);
      expect(original.patch_worked).toBe(true);

      const terminal = chain[1];
      expect(terminal.attempt).toBe(1);
      expect(terminal.origin).toBe('autofix');
      expect(terminal.http_status).toBe(200);
      expect(terminal.error).toBeUndefined();
      expect(terminal.request).toEqual(heal.healedBody);
    });

    it('passes the normalized request/response into the heal call', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      const reforward = jest.fn().mockResolvedValue(makeForward('{"ok":true}', 200));
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const requestBody = { model: 'gpt', max_tokens: 5 };

      await service.maybeHeal(
        makeParams({
          reforward,
          requestBody,
          provider: 'openai',
          apiMode: 'chat_completions',
          url: 'u',
        }),
      );

      expect(client.heal).toHaveBeenCalledTimes(1);
      const arg = client.heal.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.provider).toBe('openai');
      expect(arg.api).toBe('chat_completions');
      expect(arg.url).toBe('u');
      expect(arg.request).toEqual(requestBody);
      expect(typeof arg.traceId).toBe('string');
      expect(arg.tenantId).toBe('tenant-1');
      expect(arg.response).toEqual({
        statusCode: 400,
        error: { message: 'boom', type: null, param: null, code: null },
      });
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — resolved model reported to Phoenix (routing-alias fix)
  // -------------------------------------------------------------------------
  describe('maybeHeal resolved model', () => {
    it('reports the resolved model to Phoenix but reforwards with the routing alias', async () => {
      const client = makeHealingClient();
      // A drop_param heal: Phoenix echoes back the model it received (the
      // resolved one) with the offending param removed.
      client.heal.mockResolvedValue(
        patchedHeal({
          status: 'unverified',
          operations: [{ type: 'drop_param' }],
          healedBody: { model: 'gpt-5.1', messages: [] },
        }),
      );
      const reforward = reforwardMock('{"ok":true}', 200);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(
        makeParams({
          reforward,
          provider: 'openai',
          requestBody: { model: 'auto', messages: [], top_k: 40 },
          resolvedModel: 'gpt-5.1',
        }),
      );

      expect(result!.record.outcome).toBe('healed');

      // Phoenix receives the RESOLVED model so its model-keyed catalog can map
      // it — never the `auto` routing alias.
      const healArg = client.heal.mock.calls[0][0] as { request: Record<string, unknown> };
      expect(healArg.request.model).toBe('gpt-5.1');
      expect(healArg.request.top_k).toBe(40);

      // The reforward goes back through the agent's routing, so the body it gets
      // carries the ORIGINAL `auto` alias (a bare `gpt-5.1` would re-resolve to
      // no_provider), while the heal itself (top_k dropped) is preserved.
      const reforwardedBody = reforward.mock.calls[0][0];
      expect(reforwardedBody.model).toBe('auto');
      expect(reforwardedBody).not.toHaveProperty('top_k');
    });

    it('does not mutate the caller requestBody when substituting the resolved model', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(
        patchedHeal({ healedBody: { model: 'gpt-5.1', messages: [] } }),
      );
      const reforward = reforwardMock('{"ok":true}', 200);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const requestBody = { model: 'auto', messages: [], top_k: 40 };

      await service.maybeHeal(makeParams({ reforward, resolvedModel: 'gpt-5.1', requestBody }));

      // Substitution spreads into a new object; the caller's body is untouched.
      expect(requestBody.model).toBe('auto');
    });

    it('leaves the heal request and reforward untouched when no resolvedModel is given', async () => {
      const client = makeHealingClient();
      const heal = patchedHeal({ healedBody: { model: 'gpt', max_output_tokens: 100 } });
      client.heal.mockResolvedValue(heal);
      const reforward = reforwardMock('{"ok":true}', 200);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      await service.maybeHeal(
        makeParams({ reforward, requestBody: { model: 'gpt', max_tokens: 100 } }),
      );

      // Backward compatible: Phoenix gets the body verbatim and the reforward
      // gets the healedBody verbatim (no alias restoration).
      const healArg = client.heal.mock.calls[0][0] as { request: Record<string, unknown> };
      expect(healArg.request.model).toBe('gpt');
      expect(reforward.mock.calls[0][0]).toEqual(heal.healedBody);
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — unfixable / resolving / missing body
  // -------------------------------------------------------------------------
  describe('maybeHeal non-patch decisions', () => {
    it('no_patch → unfixable, returns the rebuilt original error, no confirm', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue({ status: 'no_patch', issueId: 'issue-2' });
      const reforward = jest.fn();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"nope"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 422), reforward }),
      );

      expect(result!.record.outcome).toBe('unfixable');
      expect(reforward).not.toHaveBeenCalled();
      expect(client.reportOutcome).not.toHaveBeenCalled();

      // The returned forward is the rebuilt original — still readable.
      expect(result!.forward.response.status).toBe(422);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);

      // Chain records the null patch/heal fields for the no_patch decision.
      const original = result!.record.chain[0];
      expect(original.phoenix_status).toBe('no_patch');
      expect(original.patch_id).toBeNull();
      expect(original.heal_attempt_id).toBeNull();
      expect(original.operations).toBeNull();
    });

    it('resolving → outcome resolving, no reforward, no confirm', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue({
        status: 'resolving',
        issueId: 'issue-3',
        retryAfterMs: 5000,
      });
      const reforward = jest.fn();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result!.record.outcome).toBe('resolving');
      expect(reforward).not.toHaveBeenCalled();
      expect(client.reportOutcome).not.toHaveBeenCalled();
    });

    it('patched but healedBody missing → unfixable', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal({ healedBody: null }));
      const reforward = jest.fn();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result!.record.outcome).toBe('unfixable');
      expect(reforward).not.toHaveBeenCalled();
      expect(client.reportOutcome).not.toHaveBeenCalled();
    });

    it('patched but healAttemptId missing → unfixable', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal({ healAttemptId: null }));
      const reforward = jest.fn();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result!.record.outcome).toBe('unfixable');
      expect(reforward).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — single attempt (no retry budget)
  // -------------------------------------------------------------------------
  describe('maybeHeal single attempt', () => {
    it('applies the patch once; if the retry still fails, reports it and gives up as unfixable', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      // The patched retry still fails with a repairable 400 — Auto-fix does NOT
      // re-heal; it reports the retry outcome to Phoenix and returns the original.
      const reforward = reforwardMock('{"error":{"message":"still-broken","code":"dup"}}', 400);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"first"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 400), reforward }),
      );

      expect(result!.record.outcome).toBe('unfixable');
      // Exactly one heal + one reforward — there is no retry budget.
      expect(client.heal).toHaveBeenCalledTimes(1);
      expect(reforward).toHaveBeenCalledTimes(1);
      // The single failed retry is reported to Phoenix with its status + error.
      expect(client.reportOutcome).toHaveBeenCalledTimes(1);
      expect(client.reportOutcome).toHaveBeenCalledWith('heal-1', {
        retryStatusCode: 400,
        error: { message: 'still-broken', type: null, param: null, code: 'dup' },
      });

      // The original entry is marked with the patch that didn't work; no terminal
      // success entry is appended.
      expect(result!.record.chain).toHaveLength(1);
      expect(result!.record.chain[0].patch_worked).toBe(false);

      // Falls back to the rebuilt original error, still readable.
      expect(result!.forward.response.status).toBe(400);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — heal transport failure
  // -------------------------------------------------------------------------
  describe('maybeHeal heal transport failure', () => {
    it('returns exhausted (no reforward, no report) when the heal call throws', async () => {
      const client = makeHealingClient();
      client.heal.mockRejectedValue(new Error('phoenix down'));
      const reforward = jest.fn();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      // Silence the expected "heal call failed" warning.
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"boom"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 400), reforward }),
      );

      expect(result!.record.outcome).toBe('exhausted');
      expect(reforward).not.toHaveBeenCalled();
      expect(client.reportOutcome).not.toHaveBeenCalled();

      // Returns the rebuilt original error.
      expect(result!.forward.response.status).toBe(400);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — a fresh `unverified` patch applies exactly like `patched`
  // -------------------------------------------------------------------------
  describe('maybeHeal unverified status', () => {
    it('applies an unverified patch (fresh, not yet confirmed) and heals', async () => {
      const client = makeHealingClient();
      // The common real-Phoenix answer for a novel resolvable error: a served
      // patch that is not yet verified. It must apply just like `patched`.
      client.heal.mockResolvedValue(patchedHeal({ status: 'unverified' }));
      const reforward = jest.fn().mockResolvedValue(makeForward('{"ok":true}', 200));
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result!.record.outcome).toBe('healed');
      expect(reforward).toHaveBeenCalledTimes(1);
      // Phoenix's real status is recorded verbatim on the chain.
      expect(result!.record.chain[0].phoenix_status).toBe('unverified');
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — heal contract error (4xx from Phoenix: bad contract / auth)
  // -------------------------------------------------------------------------
  describe('maybeHeal heal contract error', () => {
    it('returns exhausted and does NOT trip the breaker on a HealContractError', async () => {
      const client = makeHealingClient();
      // Phoenix is up but rejects every call (e.g. a missing API key → 401).
      client.heal.mockRejectedValue(new HealContractError(401, 'unauthorized'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const service = makeService({
        client: client as unknown as HealingClient,
        repo: makeAgentRepo(() => ({ autofix_enabled: true })).repo,
      });

      // Four consecutive contract errors: a transport failure would open the
      // breaker after three and skip the fourth. A contract error must not — the
      // healer is reachable, so every call still reaches it.
      for (let i = 0; i < 4; i++) {
        const r = await service.maybeHeal(
          makeParams({ forward: makeForward('{"error":{}}', 400) }),
        );
        expect(r!.record.outcome).toBe('exhausted');
      }
      expect(client.heal).toHaveBeenCalledTimes(4);
      // Surfaced loudly (error level), not swallowed as a routine warning.
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Circuit breaker — shed a slow/down healing service off the request path
  // -------------------------------------------------------------------------
  describe('circuit breaker', () => {
    const enabledRepo = () => makeAgentRepo(() => ({ autofix_enabled: true })).repo;

    it('opens after repeated heal failures and skips further heal calls', async () => {
      const client = makeHealingClient();
      client.heal.mockRejectedValue(new Error('phoenix down'));
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({
        client: client as unknown as HealingClient,
        repo: enabledRepo(),
      });

      // Three repairable failures trip the breaker (each still returns exhausted).
      for (let i = 0; i < 3; i++) {
        const r = await service.maybeHeal(
          makeParams({ forward: makeForward('{"error":{}}', 400) }),
        );
        expect(r!.record.outcome).toBe('exhausted');
      }
      expect(client.heal).toHaveBeenCalledTimes(3);

      // Breaker open: the next repairable failure skips healing entirely and
      // hands the forward back untouched (null → the proxy runs its fallback).
      const skipped = await service.maybeHeal(
        makeParams({ forward: makeForward('{"error":{}}', 400) }),
      );
      expect(skipped).toBeNull();
      expect(client.heal).toHaveBeenCalledTimes(3);
    });

    it('resets the failure streak after a successful heal round-trip', async () => {
      const client = makeHealingClient();
      client.heal
        .mockRejectedValueOnce(new Error('down'))
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValueOnce({ status: 'no_patch', issueId: 'i' })
        .mockRejectedValueOnce(new Error('down'))
        .mockRejectedValueOnce(new Error('down'))
        .mockRejectedValueOnce(new Error('down'));
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({
        client: client as unknown as HealingClient,
        repo: enabledRepo(),
      });

      // fail, fail, success (streak → 0), fail, fail: never reaches 3 in a row.
      for (let i = 0; i < 5; i++) {
        await service.maybeHeal(makeParams({ forward: makeForward('{"error":{}}', 400) }));
      }
      // Breaker still closed, so a 6th repairable failure reaches the healer.
      await service.maybeHeal(makeParams({ forward: makeForward('{"error":{}}', 400) }));
      expect(client.heal).toHaveBeenCalledTimes(6);
    });

    it('re-attempts healing once the cooldown window elapses', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
      const client = makeHealingClient();
      client.heal.mockRejectedValue(new Error('down'));
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({
        client: client as unknown as HealingClient,
        repo: enabledRepo(),
      });

      // Trip the breaker at t=1000 (open for the 30s cooldown).
      for (let i = 0; i < 3; i++) {
        await service.maybeHeal(makeParams({ forward: makeForward('{"error":{}}', 400) }));
      }
      expect(client.heal).toHaveBeenCalledTimes(3);

      // Still inside the cooldown → skipped, no heal call.
      nowSpy.mockReturnValue(20_000);
      const during = await service.maybeHeal(
        makeParams({ forward: makeForward('{"error":{}}', 400) }),
      );
      expect(during).toBeNull();
      expect(client.heal).toHaveBeenCalledTimes(3);

      // Past the cooldown → the healer is probed again.
      nowSpy.mockReturnValue(31_001);
      await service.maybeHeal(makeParams({ forward: makeForward('{"error":{}}', 400) }));
      expect(client.heal).toHaveBeenCalledTimes(4);
    });
  });

  // -------------------------------------------------------------------------
  // reportOutcome — fire-and-forget error handling
  // -------------------------------------------------------------------------
  describe('reportOutcome fire-and-forget', () => {
    it('does not throw out of maybeHeal when reportOutcome rejects', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      client.reportOutcome.mockRejectedValueOnce(new Error('report exploded'));
      const reforward = jest.fn().mockResolvedValue(makeForward('{"ok":true}', 200));
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      // Silence the expected "reportOutcome ... failed" warning from the .catch handler.
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({ client: client as unknown as HealingClient, repo });

      // Should resolve normally (the .catch handles the rejection).
      const result = await service.maybeHeal(makeParams({ reforward }));
      expect(result!.record.outcome).toBe('healed');

      // Let the fire-and-forget .catch run; must not surface as an unhandled rejection.
      await flushMicrotasks();
      expect(client.reportOutcome).toHaveBeenCalledWith('heal-1', { retryStatusCode: 200 });
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — graceful degradation (H1): never turn a provider 4xx into a 500
  // -------------------------------------------------------------------------
  describe('maybeHeal graceful degradation', () => {
    it('resolves null (does not throw) when the agent config load rejects', async () => {
      const { repo, findOne } = makeAgentRepo(() => {
        throw new Error('db down');
      });
      // Silence the expected "autofix config load failed" warning.
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({ repo });

      await expect(service.maybeHeal(makeParams({}))).resolves.toBeNull();
      expect(findOne).toHaveBeenCalledTimes(1);
    });

    it('degrades to the readable original error and preserves the audit chain when reforward rejects', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      // The heal produced a patch, but resending it blows up (network death).
      const reforward = jest.fn().mockRejectedValue(new Error('socket hang up'));
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      // Silence the expected "autofix reforward failed" warning.
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"boom"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 400), reforward }),
      );

      // Never re-throws: degrades to 'unfixable' but KEEPS the audit chain — the
      // original entry with the Phoenix ids already stamped, now patch_worked=false.
      expect(result!.record.outcome).toBe('unfixable');
      expect(result!.record.original_http_status).toBe(400);
      expect(result!.record.chain).toHaveLength(1);
      expect(result!.record.chain[0].origin).toBe('original');
      expect(result!.record.chain[0].issue_id).toBe('issue-1');
      expect(result!.record.chain[0].patch_worked).toBe(false);
      expect(typeof result!.record.groupId).toBe('string');

      // A reforward (provider) failure is not a Phoenix failure — no outcome report.
      expect(client.reportOutcome).not.toHaveBeenCalled();

      // The returned forward is the rebuilt original — still readable downstream.
      expect(result!.forward.response.status).toBe(400);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);
    });

    it('degrades via the outer backstop (exhausted, empty chain) on an unexpected throw', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      // The patch retry fails (non-ok) AND reading its body throws — an unexpected
      // path caught only by maybeHeal's outer backstop, which must still degrade
      // cleanly (never a 500) rather than surface the throw.
      const badRetry = {
        response: {
          ok: false,
          status: 400,
          text: () => Promise.reject(new Error('body already consumed')),
        },
      } as unknown as ForwardResult;
      const reforward = jest.fn().mockResolvedValue(badRetry);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward('{"error":{"message":"boom"}}', 400), reforward }),
      );

      expect(result!.record.outcome).toBe('exhausted');
      expect(result!.record.chain).toEqual([]);
      expect(result!.forward.response.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — per-agent config cache (M4)
  // -------------------------------------------------------------------------
  describe('maybeHeal config cache', () => {
    it('caches the per-agent config so a second heal for the same agent skips the DB read', async () => {
      const client = makeHealingClient();
      // Each maybeHeal needs a fresh failing forward; keep them from healing so
      // the flow is simple — no_patch returns quickly without a reforward.
      client.heal.mockResolvedValue({ status: 'no_patch', issueId: 'issue-x' });
      const { repo, findOne } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      // First heal: cold cache → one DB read.
      await service.maybeHeal(
        makeParams({ forward: makeForward('{"error":{"message":"a"}}', 400) }),
      );
      expect(findOne).toHaveBeenCalledTimes(1);

      // Second heal for the SAME agent/tenant: warm cache → no additional read.
      await service.maybeHeal(
        makeParams({ forward: makeForward('{"error":{"message":"b"}}', 400) }),
      );
      expect(findOne).toHaveBeenCalledTimes(1);

      // Invalidating the entry forces the next heal to hit the DB again.
      service.invalidateConfig('tenant-1', 'agent-1');
      await service.maybeHeal(
        makeParams({ forward: makeForward('{"error":{"message":"c"}}', 400) }),
      );
      expect(findOne).toHaveBeenCalledTimes(2);
    });

    it('caches per (tenant, agent) key so a different agent still reads the DB', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue({ status: 'no_patch', issueId: 'issue-x' });
      const { repo, findOne } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      await service.maybeHeal(
        makeParams({
          agentId: 'agent-A',
          forward: makeForward('{"error":{"message":"a"}}', 400),
        }),
      );
      // Different agent under the same tenant is a distinct cache key → new read.
      await service.maybeHeal(
        makeParams({
          agentId: 'agent-B',
          forward: makeForward('{"error":{"message":"b"}}', 400),
        }),
      );
      expect(findOne).toHaveBeenCalledTimes(2);
    });

    it('clears the whole cache once it reaches the bound, then re-populates', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue({ status: 'no_patch', issueId: 'issue-x' });
      const { repo, findOne } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      // Pre-fill the bounded cache to exactly its cap (5000) with dummy entries
      // so the next real load trips the `size >= CONFIG_CACHE_MAX` branch.
      const cache = (service as unknown as { configCache: Map<string, unknown> }).configCache;
      for (let i = 0; i < 5000; i += 1) {
        cache.set(`filler-tenant:filler-agent-${i}`, {
          value: { enabled: false },
          expiresAt: Date.now() + 30_000,
        });
      }
      expect(cache.size).toBe(5000);

      // A fresh load with a full cache clears everything, then stores this one.
      await service.maybeHeal(
        makeParams({ forward: makeForward('{"error":{"message":"z"}}', 400) }),
      );

      // DB was still read (nothing for this key survived the clear) and the cache
      // now holds only the single freshly-loaded entry.
      expect(findOne).toHaveBeenCalledTimes(1);
      expect(cache.size).toBe(1);
      expect(cache.has('tenant-1:agent-1')).toBe(true);
    });
  });
});
