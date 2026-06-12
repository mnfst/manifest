process.env['BETTER_AUTH_SECRET'] ??= 'test-encryption-secret-at-least-32-characters-long';

import { DataSource } from 'typeorm';
import { Tenant } from '../src/entities/tenant.entity';
import { Agent } from '../src/entities/agent.entity';
import { UserProvider } from '../src/entities/user-provider.entity';
import { AgentEnabledProvider } from '../src/entities/agent-enabled-provider.entity';
import { AgentDuplicationService } from '../src/analytics/services/agent-duplication.service';

/**
 * Migration-built schema (NOT synchronize). The rest of the e2e suite uses
 * `synchronize: true`, which never creates the migration-only unique index
 * `IDX_user_providers_user_provider_auth_label`. Agent duplication clones
 * user_providers rows under the new agent_id with an identical
 * (user_id, provider, auth_type, label) tuple — which collides with that
 * index in production but not under synchronize. This spec reproduces the
 * real prod schema so the regression can't hide again.
 */
describe('Agent duplication under migration-built schema (e2e)', () => {
  let ds: DataSource;
  let svc: AgentDuplicationService;

  const USER = 'dup-user-001';

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url:
        process.env['DATABASE_URL'] ??
        'postgresql://myuser:mypassword@localhost:5432/manifest_duprepro',
      entities: ['src/entities/!(*.spec).ts'],
      migrations: ['src/database/migrations/!(*.spec).ts'],
      synchronize: false,
      dropSchema: true,
      logging: false,
    });
    await ds.initialize();
    await ds.runMigrations();

    const cacheStub = {
      invalidateAgent: () => undefined,
      invalidateUser: () => undefined,
    } as unknown as ConstructorParameters<typeof AgentDuplicationService>[2];
    svc = new AgentDuplicationService(ds.getRepository(Agent), ds, cacheStub);
  }, 60000);

  afterAll(async () => {
    await ds?.destroy();
  });

  beforeEach(async () => {
    // Clean slate per test (FK-safe order).
    await ds.query('DELETE FROM "agent_enabled_providers"');
    await ds.query('DELETE FROM "user_providers"');
    await ds.query('DELETE FROM "agents"');
    await ds.query('DELETE FROM "tenants"');

    const now = new Date().toISOString();
    await ds.getRepository(Tenant).insert({ id: 'dup-tenant', name: USER, is_active: true });
    await ds.getRepository(Agent).insert({
      id: 'dup-src',
      name: 'src-agent',
      display_name: 'Src Agent',
      tenant_id: 'dup-tenant',
    });
    // A global provider (user-scoped) the source agent has access to.
    await ds.getRepository(UserProvider).insert({
      id: 'dup-up1',
      user_id: USER,
      agent_id: 'dup-src',
      provider: 'anthropic',
      api_key_encrypted: 'enc-value',
      key_prefix: 'sk-ant',
      auth_type: 'api_key',
      label: 'Research key',
      priority: 0,
      region: null,
      is_active: true,
      connected_at: now,
      updated_at: now,
      cached_models: null,
      models_fetched_at: null,
    });
    await ds
      .getRepository(AgentEnabledProvider)
      .insert({ agent_id: 'dup-src', user_provider_id: 'dup-up1' });
  });

  it('duplicates without colliding on the user-scoped unique index', async () => {
    await expect(
      svc.duplicate(USER, 'src-agent', { name: 'src-agent-copy', displayName: 'Copy' }),
    ).resolves.toMatchObject({ agentName: 'src-agent-copy' });
  });

  it('shares the global provider via a copied enabled-provider row instead of cloning it', async () => {
    const result = await svc.duplicate(USER, 'src-agent', {
      name: 'src-agent-copy',
      displayName: 'Copy',
    });

    // The global credential row is NOT duplicated — still exactly one.
    const ups = await ds.getRepository(UserProvider).find({ where: { user_id: USER } });
    expect(ups).toHaveLength(1);

    // The new agent gets its own enabled-provider row pointing at the SAME global provider.
    const enabledRows = await ds
      .getRepository(AgentEnabledProvider)
      .find({ where: { agent_id: result.agentId } });
    expect(enabledRows).toEqual([{ agent_id: result.agentId, user_provider_id: 'dup-up1' }]);
  });
});
