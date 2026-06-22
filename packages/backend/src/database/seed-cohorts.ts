import { DataSource, Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import type { ModelRoute } from 'manifest-shared';
import { auth } from '../auth/auth.instance';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { TenantProvider } from '../entities/tenant-provider.entity';
import { AgentEnabledProvider } from '../entities/agent-enabled-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../entities/specificity-assignment.entity';
import { hashKey, keyPrefix } from '../common/utils/hash.util';
import { getSeedConnections } from './seed-messages';

const NEW_USER_EMAIL = 'newuser@manifest.build';
const NEW_USER_PASSWORD = 'manifest';
const NEW_TENANT_ID = 'seed-tenant-new-001';
const NEW_AGENT_ID = 'seed-agent-new-001';
const NEW_OTLP_KEY_ID = 'seed-otlp-key-new-001';
const NEW_OTLP_KEY = 'mnfst_dev-otlp-key-new-001';

/** Public so tests / logs / docs share one source of truth for the cohort logins. */
export const COHORT_SEED = {
  newUserEmail: NEW_USER_EMAIL,
  newUserPassword: NEW_USER_PASSWORD,
  newTenantId: NEW_TENANT_ID,
  newAgentId: NEW_AGENT_ID,
  newOtlpKey: NEW_OTLP_KEY,
} as const;

// Model targets for the legacy agent's complexity tiers — purely cosmetic, so
// the four tier cards show real models instead of empty pickers in the demo.
const LEGACY_TIER_ROUTES: ModelRoute[] = [
  { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
  { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
  { provider: 'anthropic', authType: 'subscription', model: 'claude-sonnet-4-5-20250929' },
  { provider: 'anthropic', authType: 'subscription', model: 'claude-sonnet-4-5-20250929' },
];

const LEGACY_SPECIFICITY_ROUTES: Record<string, ModelRoute> = {
  coding: { provider: 'anthropic', authType: 'subscription', model: 'claude-sonnet-4-5-20250929' },
  trading: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
};

export interface CohortSeedDeps {
  dataSource: DataSource;
  tenantRepo: Repository<Tenant>;
  agentRepo: Repository<Agent>;
  agentKeyRepo: Repository<AgentApiKey>;
  providerRepo: Repository<TenantProvider>;
  enabledProviderRepo: Repository<AgentEnabledProvider>;
  tierRepo: Repository<TierAssignment>;
  specificityRepo: Repository<SpecificityAssignment>;
  logger: Logger;
  /** The existing admin demo agent id — becomes the "legacy" cohort. */
  legacyAgentId: string;
}

/**
 * Seeds two routing cohorts that demonstrate the complexity / task-specific
 * deprecation gate:
 *
 * - **legacy** — the existing admin demo agent, enriched so it is "invested" in
 *   the deprecated surfaces (complexity routing on with per-tier overrides +
 *   active task-specific categories). Its providers are enabled so the routing
 *   page renders.
 * - **clean** — a brand-new user + agent with providers enabled but no
 *   complexity / task-specific config, so the dashboard shows the simplified
 *   Default + Custom surface only.
 *
 * Idempotent: keyed on the clean agent, so re-seeding an existing DB is a no-op.
 */
export async function seedRoutingCohorts(deps: CohortSeedDeps): Promise<void> {
  const exists = await deps.agentRepo.count({ where: { id: NEW_AGENT_ID } });
  if (exists > 0) return;

  await seedLegacyCohort(deps);
  await seedCleanCohort(deps);

  deps.logger.log(
    `Seeded routing cohorts: legacy=${deps.legacyAgentId} (complexity + task-specific visible), ` +
      `clean=${NEW_USER_EMAIL} (Default + Custom only)`,
  );
}

async function seedLegacyCohort(deps: CohortSeedDeps): Promise<void> {
  const agentId = deps.legacyAgentId;

  // Enable the already-seeded provider connections for the demo agent so the
  // routing page renders tabs (it gates on "has at least one enabled provider").
  for (const conn of getSeedConnections()) {
    await deps.enabledProviderRepo.insert({ agent_id: agentId, tenant_provider_id: conn.id });
  }

  // Mark the agent as invested in the deprecated routing surfaces.
  await deps.agentRepo.update({ id: agentId }, { complexity_routing_enabled: true });

  await deps.tierRepo.insert(
    ['simple', 'standard', 'complex', 'reasoning'].map((tier, i) => ({
      id: `seed-tier-${tier}`,
      agent_id: agentId,
      tier,
      override_route: LEGACY_TIER_ROUTES[i],
    })),
  );

  await deps.specificityRepo.insert(
    ['coding', 'trading'].map((category) => ({
      id: `seed-spec-${category}`,
      agent_id: agentId,
      category,
      is_active: true,
      override_route: LEGACY_SPECIFICITY_ROUTES[category],
    })),
  );
}

async function seedCleanCohort(deps: CohortSeedDeps): Promise<void> {
  await auth.api.signUpEmail({
    body: { email: NEW_USER_EMAIL, password: NEW_USER_PASSWORD, name: 'New User' },
  });
  await deps.dataSource.query(`UPDATE "user" SET "emailVerified" = true WHERE email = $1`, [
    NEW_USER_EMAIL,
  ]);
  const rows = await deps.dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [
    NEW_USER_EMAIL,
  ]);
  const userId = rows.length > 0 ? String(rows[0].id) : null;
  if (!userId) return;

  await deps.tenantRepo.insert({
    id: NEW_TENANT_ID,
    name: userId,
    owner_user_id: userId,
    organization_name: 'New User Org',
    email: NEW_USER_EMAIL,
    is_active: true,
  });

  await deps.agentRepo.insert({
    id: NEW_AGENT_ID,
    name: 'demo-agent',
    description: 'Fresh agent — clean routing surface (Default + Custom only)',
    agent_category: 'personal',
    agent_platform: 'openclaw',
    is_active: true,
    tenant_id: NEW_TENANT_ID,
  });

  await deps.agentKeyRepo.insert({
    id: NEW_OTLP_KEY_ID,
    key: null,
    key_hash: hashKey(NEW_OTLP_KEY),
    key_prefix: keyPrefix(NEW_OTLP_KEY),
    label: 'Demo OTLP ingest key',
    tenant_id: NEW_TENANT_ID,
    agent_id: NEW_AGENT_ID,
    is_active: true,
  });

  // The clean tenant needs its own provider connections; enable them for the
  // agent so the routing page renders. No complexity / task-specific rows are
  // seeded, so the agent stays in the "clean" cohort.
  for (const conn of getSeedConnections()) {
    const providerId = `${conn.id}-new`;
    await deps.providerRepo.insert({
      id: providerId,
      tenant_id: NEW_TENANT_ID,
      created_by_user_id: userId,
      provider: conn.provider,
      auth_type: conn.auth_type,
      label: 'Default',
      priority: 0,
      is_active: true,
    });
    await deps.enabledProviderRepo.insert({
      agent_id: NEW_AGENT_ID,
      tenant_provider_id: providerId,
    });
  }
}
