import { Like, Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { inferProviderFromModel } from 'manifest-shared';
import { AgentMessage } from '../entities/agent-message.entity';
import { ManifestRequest } from '../entities/request.entity';
import {
  generateSeedChains,
  SEED_MODELS,
  SEED_PRIMARY_MODEL,
  seedConnectionId,
} from './seed-request-chains';

export { SEED_MODELS, SEED_PRIMARY_MODEL, seedConnectionId };

export interface SeedConnection {
  id: string;
  provider: string;
  auth_type: 'subscription' | 'api_key';
}

/**
 * Distinct (provider, auth_type) connections behind the seeded attempts. The
 * seeder creates one tenant_providers row per entry and stamps the matching
 * tenant_provider_id on every seeded attempt, so per-connection analytics
 * resolve against a real connection rather than the legacy tuple.
 */
export function getSeedConnections(): SeedConnection[] {
  const seen = new Map<string, SeedConnection>();
  for (const m of [...SEED_MODELS, SEED_PRIMARY_MODEL]) {
    const provider = inferProviderFromModel(m.name);
    if (!provider) continue;
    const key = `${provider}:${m.auth_type}`;
    if (!seen.has(key)) {
      seen.set(key, {
        id: seedConnectionId(provider, m.auth_type),
        provider,
        auth_type: m.auth_type,
      });
    }
  }
  return [...seen.values()];
}

interface SeedContext {
  tenantId: string;
  agentId: string;
  agentName: string;
}

/**
 * Seed demo requests + attempts (request-first, chains included).
 *
 * Idempotence — the invariant this enforces on EVERY boot is "the seed data
 * follows the request model: every attempt belongs to a request":
 *  - coherent seed already present (seed attempts AND seed requests) → no-op;
 *  - no seed rows at all → seed, unless the DB already holds real (non-seed)
 *    traffic, which we never pollute;
 *  - stale flat seed (seed attempts WITHOUT seed requests — written by the
 *    pre-request seeder) → wipe the seed rows and re-seed with chains, so a
 *    dev DB created before the request model upgrades itself on restart.
 */
export async function seedAgentMessages(
  messageRepo: Repository<AgentMessage>,
  requestRepo: Repository<ManifestRequest>,
  userId: string,
  logger: Logger,
  ctx: SeedContext = {
    tenantId: 'seed-tenant-001',
    agentId: 'seed-agent-001',
    agentName: 'demo-agent',
  },
): Promise<void> {
  // Idempotence is judged on the SEED rows alone: SEED_DATA=true is already
  // the explicit opt-in (checked by the caller), and real traffic keys never
  // collide with the seed-* id prefixes, so coexistence is safe.
  const seedAttempts = await messageRepo.count({ where: { id: Like('seed-msg-%') } });
  const seedRequests = await requestRepo.count({ where: { id: Like('seed-req-%') } });
  if (seedAttempts > 0 && seedRequests > 0) return;

  if (seedAttempts > 0 || seedRequests > 0) {
    // Legacy flat seed (attempts without parent requests) — upgrade it.
    await messageRepo.delete({ id: Like('seed-msg-%') });
    await requestRepo.delete({ id: Like('seed-req-%') });
    logger.log('Replacing legacy flat seed data with request-shaped seed data');
  }

  const chains = generateSeedChains({ ...ctx, userId }, Date.now());
  const requests = chains.map((c) => c.request);
  const attempts = chains.flatMap((c) => c.attempts);

  // Requests first: provider_attempts.request_id references requests(id).
  for (let i = 0; i < requests.length; i += 100) {
    await requestRepo.insert(requests.slice(i, i + 100));
  }
  for (let i = 0; i < attempts.length; i += 100) {
    await messageRepo.insert(attempts.slice(i, i + 100));
  }
  logger.log(`Seeded ${requests.length} requests (${attempts.length} attempts)`);
}
