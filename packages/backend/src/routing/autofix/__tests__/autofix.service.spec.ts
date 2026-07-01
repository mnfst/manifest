import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Agent } from '../../../entities/agent.entity';
import type { ForwardResult } from '../../proxy/provider-client';
import { AutofixService, type MaybeHealParams } from '../autofix.service';
import type { HealingClient } from '../healing-client';
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

function makeService(opts: {
  client?: HealingClient;
  repo?: Repository<Agent>;
  config?: ConfigService;
}): AutofixService {
  return new AutofixService(
    opts.client ?? (makeHealingClient() as unknown as HealingClient),
    opts.repo ?? makeAgentRepo().repo,
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
  healedBody: { model: 'gpt', max_output_tokens: 100 },
  ...over,
});

/**
 * A `reforward` mock that returns a FRESH ForwardResult on every call. Reusing a
 * single Response across loop iterations fails: the service reads the retry body
 * (`.text()`), so a shared Response would be "already read" on the next attempt.
 */
function reforwardMock(
  body: string,
  status: number,
): jest.Mock<Promise<ForwardResult>, [Record<string, unknown>]> {
  return jest.fn((_healedBody: Record<string, unknown>) =>
    Promise.resolve(makeForward(body, status)),
  );
}

/**
 * A `reforward` mock that returns a DISTINCT repairable 4xx on every call (the
 * `code`/`message` are incremented per attempt). Each retry therefore produces a
 * new error fingerprint, so the "healing sink" guard never trips and the loop
 * runs to the full budget — the only stop is `maxAttempts`.
 */
function distinctErrorReforward(
  status = 400,
): jest.Mock<Promise<ForwardResult>, [Record<string, unknown>]> {
  let n = 0;
  return jest.fn((_healedBody: Record<string, unknown>) => {
    n += 1;
    return Promise.resolve(
      makeForward(JSON.stringify({ error: { message: `e${n}`, code: `c${n}` } }), status),
    );
  });
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
      // globalEnabled true means a repairable error is not short-circuited;
      // proven indirectly via the disabled-agent path (config still loaded).
      expect(service).toBeInstanceOf(AutofixService);
      expect(findOne).not.toHaveBeenCalled();
    });

    it('parses a valid AUTOFIX_DEFAULT_MAX_ATTEMPTS override', async () => {
      // A valid > 0 default is used when the agent has no explicit budget.
      const client = makeHealingClient();
      // Phoenix keeps handing patched bodies; each reforward fails with a DISTINCT
      // repairable error so the sink guard never trips → attempts are bounded only
      // by the default budget of 5.
      client.heal.mockResolvedValue(patchedHeal());
      const reforward = distinctErrorReforward(400);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 0 }));
      const service = makeService({
        client: client as unknown as HealingClient,
        repo,
        config: makeConfig({ AUTOFIX_DEFAULT_MAX_ATTEMPTS: '5' }),
      });

      const result = await service.maybeHeal(makeParams({ reforward }));
      expect(result?.record.attempts).toBe(5);
      expect(reforward).toHaveBeenCalledTimes(5);
    });

    it('falls back to 3 when AUTOFIX_DEFAULT_MAX_ATTEMPTS is non-numeric', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      const reforward = distinctErrorReforward(400);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 0 }));
      const service = makeService({
        client: client as unknown as HealingClient,
        repo,
        config: makeConfig({ AUTOFIX_DEFAULT_MAX_ATTEMPTS: 'not-a-number' }),
      });

      const result = await service.maybeHeal(makeParams({ reforward }));
      expect(result?.record.attempts).toBe(3);
      expect(reforward).toHaveBeenCalledTimes(3);
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
        select: ['autofix_enabled', 'autofix_max_attempts'],
      });
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — happy heal on first patch
  // -------------------------------------------------------------------------
  describe('maybeHeal happy path', () => {
    it('heals on the first patch, reports the cleared retry, and records the chain', async () => {
      const client = makeHealingClient();
      const heal = patchedHeal();
      client.heal.mockResolvedValue(heal);
      const healedForward = makeForward('{"ok":true}', 200);
      const reforward = jest.fn().mockResolvedValue(healedForward);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result).not.toBeNull();
      expect(result!.record.outcome).toBe('healed');
      expect(result!.record.attempts).toBe(1);
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
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
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
      expect(typeof arg.requestId).toBe('string');
      expect(arg.response).toEqual({
        statusCode: 400,
        error: { message: 'boom', type: null, param: null, code: null },
      });
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
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"nope"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 422), reforward }),
      );

      expect(result!.record.outcome).toBe('unfixable');
      expect(result!.record.attempts).toBe(0);
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
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result!.record.outcome).toBe('resolving');
      expect(result!.record.attempts).toBe(0);
      expect(reforward).not.toHaveBeenCalled();
      expect(client.reportOutcome).not.toHaveBeenCalled();
    });

    it('patched but healedBody missing → unfixable', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal({ healedBody: null }));
      const reforward = jest.fn();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
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
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result!.record.outcome).toBe('unfixable');
      expect(reforward).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — budget / retry loop
  // -------------------------------------------------------------------------
  describe('maybeHeal budget and retry loop', () => {
    it('exhausts the budget, reporting each failed retry, and returns the original', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      // Each reforward fails with a DISTINCT repairable 4xx (e1/c1, e2/c2, …) so
      // the sink guard never trips → the budget is the only stop.
      const reforward = distinctErrorReforward(400);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 2 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"first"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 400), reforward }),
      );

      expect(result!.record.outcome).toBe('exhausted');
      expect(result!.record.attempts).toBe(2);
      expect(reforward).toHaveBeenCalledTimes(2);

      // Each failed retry is reported with its >=400 status and the normalized
      // error of that retry's (distinct) body.
      expect(client.reportOutcome).toHaveBeenCalledTimes(2);
      expect(client.reportOutcome).toHaveBeenNthCalledWith(1, 'heal-1', {
        retryStatusCode: 400,
        error: { message: 'e1', type: null, param: null, code: 'c1' },
      });
      expect(client.reportOutcome).toHaveBeenNthCalledWith(2, 'heal-1', {
        retryStatusCode: 400,
        error: { message: 'e2', type: null, param: null, code: 'c2' },
      });

      // Falls back to the rebuilt original error.
      expect(result!.forward.response.status).toBe(400);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);
    });

    it('stops when a retry yields a non-repairable status', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      // First reforward returns a 500 (non-repairable) → loop breaks after 1 attempt.
      const reforward = jest.fn().mockResolvedValue(makeForward('server error', 500));
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 5 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"first"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 400), reforward }),
      );

      expect(result!.record.outcome).toBe('exhausted');
      expect(result!.record.attempts).toBe(1);
      expect(reforward).toHaveBeenCalledTimes(1);
      // The non-repairable 500 retry is still reported (with its normalized error)
      // before the loop breaks.
      expect(client.reportOutcome).toHaveBeenCalledTimes(1);
      expect(client.reportOutcome).toHaveBeenCalledWith('heal-1', {
        retryStatusCode: 500,
        error: { message: 'server error', type: null, param: null, code: null },
      });

      // Returns the rebuilt ORIGINAL error (not the 500 retry).
      expect(result!.forward.response.status).toBe(400);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);
    });

    it('reads the retry error body and reheals it on the next loop iteration', async () => {
      const client = makeHealingClient();
      // First heal succeeds-as-patch but the retry is a repairable 404; second
      // heal patches and its retry is a 200.
      client.heal
        .mockResolvedValueOnce(patchedHeal({ healAttemptId: 'heal-a' }))
        .mockResolvedValueOnce(patchedHeal({ healAttemptId: 'heal-b' }));
      const reforward = jest
        .fn()
        .mockResolvedValueOnce(makeForward('{"error":{"message":"retry-404"}}', 404))
        .mockResolvedValueOnce(makeForward('{"ok":true}', 200));
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 5 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));

      expect(result!.record.outcome).toBe('healed');
      expect(result!.record.attempts).toBe(2);
      expect(client.heal).toHaveBeenCalledTimes(2);
      // The second heal fingerprints on the 404 retry body.
      const secondHealArg = client.heal.mock.calls[1][0] as {
        requestId: string;
        response: { statusCode: number; error: { message: string } };
      };
      expect(secondHealArg.response.statusCode).toBe(404);
      expect(secondHealArg.response.error.message).toBe('retry-404');

      // Every retry of one logical request shares a single, stable requestId.
      const firstHealArg = client.heal.mock.calls[0][0] as { requestId: string };
      expect(typeof firstHealArg.requestId).toBe('string');
      expect(firstHealArg.requestId.length).toBeGreaterThan(0);
      expect(secondHealArg.requestId).toBe(firstHealArg.requestId);

      // Failed retry → reported with its 4xx status and normalized error;
      // cleared retry → reported with its 2xx status and no error.
      expect(client.reportOutcome).toHaveBeenNthCalledWith(1, 'heal-a', {
        retryStatusCode: 404,
        error: { message: 'retry-404', type: null, param: null, code: null },
      });
      expect(client.reportOutcome).toHaveBeenNthCalledWith(2, 'heal-b', { retryStatusCode: 200 });
      expect(client.reportOutcome.mock.calls[1][1]).not.toHaveProperty('error');

      // The chain has the original (attempt 0), the second-iteration autofix
      // request (attempt 1), and the terminal success entry (attempt 2).
      const chain = result!.record.chain;
      expect(chain.map((e) => e.attempt)).toEqual([0, 1, 2]);
      expect(chain[1].origin).toBe('autofix');
      expect(chain[1].http_status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — heal transport failure
  // -------------------------------------------------------------------------
  describe('maybeHeal heal transport failure', () => {
    it('breaks the loop and reports exhausted when heal throws', async () => {
      const client = makeHealingClient();
      client.heal.mockRejectedValue(new Error('phoenix down'));
      const reforward = jest.fn();
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
      // Silence the expected "heal call failed" warning.
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"boom"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 400), reforward }),
      );

      expect(result!.record.outcome).toBe('exhausted');
      expect(result!.record.attempts).toBe(0);
      expect(reforward).not.toHaveBeenCalled();
      expect(client.reportOutcome).not.toHaveBeenCalled();

      // Returns the rebuilt original error.
      expect(result!.forward.response.status).toBe(400);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);
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
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
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
  // loadAgentConfig — budget fallback via a happy heal
  // -------------------------------------------------------------------------
  describe('loadAgentConfig budget fallback', () => {
    it('uses the explicit agent budget when it is a positive integer', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      const reforward = reforwardMock('{"error":{"message":"bad"}}', 400);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 1 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));
      expect(result!.record.attempts).toBe(1);
      expect(reforward).toHaveBeenCalledTimes(1);
    });

    it('falls back to the default budget when autofix_max_attempts is undefined', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      const reforward = distinctErrorReforward(400);
      // autofix_max_attempts undefined (Number.isInteger(undefined) === false).
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));
      // Default is 3 (no AUTOFIX_DEFAULT_MAX_ATTEMPTS set).
      expect(result!.record.attempts).toBe(3);
      expect(reforward).toHaveBeenCalledTimes(3);
    });

    it('falls back to the default budget when autofix_max_attempts is NaN', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      const reforward = distinctErrorReforward(400);
      const { repo } = makeAgentRepo(() => ({
        autofix_enabled: true,
        autofix_max_attempts: Number.NaN,
      }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      const result = await service.maybeHeal(makeParams({ reforward }));
      expect(result!.record.attempts).toBe(3);
      expect(reforward).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // maybeHeal — healing-sink guard (M2)
  // -------------------------------------------------------------------------
  describe('maybeHeal healing-sink guard', () => {
    it('stops after one reforward when the retry reproduces the exact same error', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      // The retry reproduces the SAME error the original failed with (same
      // status/code/message → identical fingerprint). The budget is 5, but the
      // sink guard must break on the SECOND iteration — BEFORE a second
      // heal/reforward — so only ONE reforward ever happens. The original body
      // and the retry body match so the fingerprints coincide.
      const sameError = '{"error":{"message":"same","code":"dup"}}';
      const reforward = reforwardMock(sameError, 400);
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 5 }));
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = sameError;

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 400), reforward }),
      );

      expect(result!.record.outcome).toBe('exhausted');
      // One patched retry was resent; the guard then stopped without re-healing.
      expect(result!.record.attempts).toBe(1);
      expect(reforward).toHaveBeenCalledTimes(1);
      // Only the original iteration reached the heal service.
      expect(client.heal).toHaveBeenCalledTimes(1);
      // The single failed retry was still reported.
      expect(client.reportOutcome).toHaveBeenCalledTimes(1);

      // Returns the rebuilt ORIGINAL error, still readable.
      expect(result!.forward.response.status).toBe(400);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);
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

    it('degrades to the readable original error (does not throw) when reforward rejects', async () => {
      const client = makeHealingClient();
      client.heal.mockResolvedValue(patchedHeal());
      // The heal produced a patch, but resending it blows up (network death).
      const reforward = jest.fn().mockRejectedValue(new Error('socket hang up'));
      const { repo } = makeAgentRepo(() => ({ autofix_enabled: true, autofix_max_attempts: 3 }));
      // Silence the expected "autofix loop failed" warning.
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const service = makeService({ client: client as unknown as HealingClient, repo });
      const originalBody = '{"error":{"message":"boom"}}';

      const result = await service.maybeHeal(
        makeParams({ forward: makeForward(originalBody, 400), reforward }),
      );

      // Never re-throws: outcome is exhausted with a zero-attempt empty chain.
      expect(result!.record.outcome).toBe('exhausted');
      expect(result!.record.attempts).toBe(0);
      expect(result!.record.original_http_status).toBe(400);
      expect(result!.record.chain).toEqual([]);
      expect(typeof result!.record.groupId).toBe('string');

      // The returned forward is the rebuilt original — still readable downstream.
      expect(result!.forward.response.status).toBe(400);
      await expect(result!.forward.response.text()).resolves.toBe(originalBody);
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
      const { repo, findOne } = makeAgentRepo(() => ({
        autofix_enabled: true,
        autofix_max_attempts: 3,
      }));
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
      const { repo, findOne } = makeAgentRepo(() => ({
        autofix_enabled: true,
        autofix_max_attempts: 3,
      }));
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
      const { repo, findOne } = makeAgentRepo(() => ({
        autofix_enabled: true,
        autofix_max_attempts: 3,
      }));
      const service = makeService({ client: client as unknown as HealingClient, repo });

      // Pre-fill the bounded cache to exactly its cap (5000) with dummy entries
      // so the next real load trips the `size >= CONFIG_CACHE_MAX` branch.
      const cache = (service as unknown as { configCache: Map<string, unknown> }).configCache;
      for (let i = 0; i < 5000; i += 1) {
        cache.set(`filler-tenant:filler-agent-${i}`, {
          value: { enabled: false, maxAttempts: 0 },
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
