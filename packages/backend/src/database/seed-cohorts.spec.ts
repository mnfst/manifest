import { Logger } from '@nestjs/common';
import { seedRoutingCohorts, COHORT_SEED, type CohortSeedDeps } from './seed-cohorts';
import { getSeedConnections } from './seed-messages';
import { keyPrefix, verifyKey } from '../common/utils/hash.util';

jest.mock('../auth/auth.instance', () => ({
  auth: { api: { signUpEmail: jest.fn() } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require('../auth/auth.instance');

function makeRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
}

describe('seedRoutingCohorts', () => {
  let deps: CohortSeedDeps;
  let mockQuery: jest.Mock;
  let logger: { log: jest.Mock };
  let repos: {
    tenant: ReturnType<typeof makeRepo>;
    agent: ReturnType<typeof makeRepo>;
    agentKey: ReturnType<typeof makeRepo>;
    provider: ReturnType<typeof makeRepo>;
    enabledProvider: ReturnType<typeof makeRepo>;
    tier: ReturnType<typeof makeRepo>;
    specificity: ReturnType<typeof makeRepo>;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = jest.fn();
    logger = { log: jest.fn() };
    repos = {
      tenant: makeRepo(),
      agent: makeRepo(),
      agentKey: makeRepo(),
      provider: makeRepo(),
      enabledProvider: makeRepo(),
      tier: makeRepo(),
      specificity: makeRepo(),
    };
    deps = {
      dataSource: { query: mockQuery } as never,
      tenantRepo: repos.tenant as never,
      agentRepo: repos.agent as never,
      agentKeyRepo: repos.agentKey as never,
      providerRepo: repos.provider as never,
      enabledProviderRepo: repos.enabledProvider as never,
      tierRepo: repos.tier as never,
      specificityRepo: repos.specificity as never,
      logger: logger as unknown as Logger,
      legacyAgentId: 'seed-agent-001',
    };
    // Clean cohort issues two queries: UPDATE emailVerified, then SELECT id.
    mockQuery.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ id: 'new-user-id' }]);
    auth.api.signUpEmail.mockResolvedValue({});
  });

  it('skips entirely when the clean agent already exists (idempotent re-seed)', async () => {
    repos.agent.count.mockResolvedValue(1);

    await seedRoutingCohorts(deps);

    expect(repos.agent.update).not.toHaveBeenCalled();
    expect(repos.tenant.insert).not.toHaveBeenCalled();
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('enriches the legacy agent: enables providers, turns complexity on, seeds tiers + categories', async () => {
    await seedRoutingCohorts(deps);

    const conns = getSeedConnections();
    expect(repos.enabledProvider.insert).toHaveBeenCalledWith({
      agent_id: 'seed-agent-001',
      tenant_provider_id: conns[0].id,
    });
    expect(repos.agent.update).toHaveBeenCalledWith(
      { id: 'seed-agent-001' },
      { complexity_routing_enabled: true },
    );

    const tierArg = repos.tier.insert.mock.calls[0][0] as Array<{ tier: string }>;
    expect(tierArg.map((t) => t.tier)).toEqual(['simple', 'standard', 'complex', 'reasoning']);

    const specArg = repos.specificity.insert.mock.calls[0][0] as Array<{
      category: string;
      is_active: boolean;
    }>;
    expect(specArg.map((s) => s.category)).toEqual(['coding', 'trading']);
    expect(specArg.every((s) => s.is_active)).toBe(true);
  });

  it('creates the clean user, tenant, agent, OTLP key, and enabled providers', async () => {
    await seedRoutingCohorts(deps);

    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: {
        email: COHORT_SEED.newUserEmail,
        password: COHORT_SEED.newUserPassword,
        name: 'New User',
      },
    });
    expect(mockQuery).toHaveBeenCalledWith(
      `UPDATE "user" SET "emailVerified" = true WHERE email = $1`,
      [COHORT_SEED.newUserEmail],
    );
    expect(repos.tenant.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: COHORT_SEED.newTenantId, owner_user_id: 'new-user-id' }),
    );
    expect(repos.agent.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: COHORT_SEED.newAgentId, tenant_id: COHORT_SEED.newTenantId }),
    );

    const keyArg = repos.agentKey.insert.mock.calls[0][0] as {
      key: unknown;
      key_hash: string;
      key_prefix: string;
    };
    expect(keyArg.key).toBeNull();
    expect(verifyKey(COHORT_SEED.newOtlpKey, keyArg.key_hash)).toBe(true);
    expect(keyArg.key_prefix).toBe(keyPrefix(COHORT_SEED.newOtlpKey));

    const conns = getSeedConnections();
    expect(repos.provider.insert).toHaveBeenCalledTimes(conns.length);
    expect(repos.provider.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: `${conns[0].id}-new`, tenant_id: COHORT_SEED.newTenantId }),
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Seeded routing cohorts'));
  });

  it('aborts the clean cohort when the new user id cannot be resolved', async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]); // SELECT → no rows

    await seedRoutingCohorts(deps);

    // The legacy enrichment still ran...
    expect(repos.agent.update).toHaveBeenCalled();
    // ...but the clean cohort bailed before creating the tenant/agent.
    expect(repos.tenant.insert).not.toHaveBeenCalled();
    expect(repos.agent.insert).not.toHaveBeenCalled();
  });
});
