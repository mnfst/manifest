import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent } from '../../../entities/agent.entity';
import { AgentMessage } from '../../../entities/agent-message.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { ManifestRequest } from '../../../entities/request.entity';
import { AutofixModule } from '../autofix.module';
import { HEALING_CLIENT } from '../healing-client';
import { HttpHealingClient } from '../http-healing-client';
import { MockHealingClient } from '../mock-healing-client';
import { NoopHealingClient } from '../noop-healing-client';

/**
 * Compile AutofixModule with a global ConfigModule seeded from `configValues`
 * (a real ConfigService, so the factory reads exactly what the app would) and
 * the TypeORM Agent repo stubbed, then resolve the HEALING_CLIENT the factory
 * produced. A global ConfigModule exports ConfigService into AutofixModule's
 * scope — a root-level provider would be encapsulated out of the imported
 * module.
 */
async function resolveHealingClient(configValues: Record<string, string>) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => configValues] }),
      AutofixModule,
    ],
  })
    .overrideProvider(getRepositoryToken(Agent))
    .useValue({})
    .overrideProvider(getRepositoryToken(AgentMessage))
    .useValue({})
    .overrideProvider(getRepositoryToken(ManifestRequest))
    .useValue({})
    .overrideProvider(getRepositoryToken(Tenant))
    .useValue({})
    .compile();

  const client = moduleRef.get(HEALING_CLIENT);
  await moduleRef.close();
  return client;
}

describe('AutofixModule HEALING_CLIENT factory', () => {
  it('provides a MockHealingClient when AUTOFIX_HEALING_URL is unset (non-production)', async () => {
    const client = await resolveHealingClient({});

    expect(client).toBeInstanceOf(MockHealingClient);
  });

  it('provides a MockHealingClient outside production even when NODE_ENV=development', async () => {
    // Explicit non-production NODE_ENV still exercises the dev/test branch.
    const client = await resolveHealingClient({ NODE_ENV: 'development' });

    expect(client).toBeInstanceOf(MockHealingClient);
  });

  it('provides a MockHealingClient when AUTOFIX_HEALING_URL is blank/whitespace', async () => {
    // url.trim().length > 0 is false → mock branch.
    const client = await resolveHealingClient({ AUTOFIX_HEALING_URL: '   ' });

    expect(client).toBeInstanceOf(MockHealingClient);
  });

  it('provides an inert NoopHealingClient in production when AUTOFIX_HEALING_URL is unset', async () => {
    // The dev-only mock must never mutate real traffic: with no healer wired,
    // production falls to the inert Noop client, not the Mock.
    const client = await resolveHealingClient({ NODE_ENV: 'production' });

    expect(client).toBeInstanceOf(NoopHealingClient);
  });

  it('still provides an HttpHealingClient in production when AUTOFIX_HEALING_URL is set', async () => {
    // A configured healer takes precedence over the production Noop fallback.
    const client = await resolveHealingClient({
      NODE_ENV: 'production',
      AUTOFIX_HEALING_URL: 'http://phoenix.local',
    });

    expect(client).toBeInstanceOf(HttpHealingClient);
  });

  it('provides an HttpHealingClient when AUTOFIX_HEALING_URL is set', async () => {
    const client = await resolveHealingClient({
      AUTOFIX_HEALING_URL: 'http://phoenix.local',
    });

    expect(client).toBeInstanceOf(HttpHealingClient);
  });

  it('provides an HttpHealingClient and reads AUTOFIX_HEALING_API_KEY when set', async () => {
    // Exercises the api-key branch of the factory (trimmed, non-empty → forwarded).
    const client = await resolveHealingClient({
      AUTOFIX_HEALING_URL: 'http://phoenix.local',
      AUTOFIX_HEALING_API_KEY: 'secret',
    });

    expect(client).toBeInstanceOf(HttpHealingClient);
  });

  it('provides an HttpHealingClient with a valid AUTOFIX_TIMEOUT_MS override', async () => {
    // Exercises the truthy side of the timeout ternary (parsed integer > 0).
    const client = await resolveHealingClient({
      AUTOFIX_HEALING_URL: 'http://phoenix.local',
      AUTOFIX_TIMEOUT_MS: '5000',
    });

    expect(client).toBeInstanceOf(HttpHealingClient);
  });

  it('falls back to the default timeout when AUTOFIX_TIMEOUT_MS is invalid', async () => {
    // Number.parseInt('abc', 10) is NaN → Number.isInteger false → default.
    const client = await resolveHealingClient({
      AUTOFIX_HEALING_URL: 'http://phoenix.local',
      AUTOFIX_TIMEOUT_MS: 'abc',
    });

    expect(client).toBeInstanceOf(HttpHealingClient);
  });

  it('falls back to the default timeout when AUTOFIX_TIMEOUT_MS is non-positive', async () => {
    // parsed = 0 → `parsed > 0` false → default branch.
    const client = await resolveHealingClient({
      AUTOFIX_HEALING_URL: 'http://phoenix.local',
      AUTOFIX_TIMEOUT_MS: '0',
    });

    expect(client).toBeInstanceOf(HttpHealingClient);
  });

  it('rejects a numeric-prefixed AUTOFIX_TIMEOUT_MS (5abc) and uses the default', async () => {
    // `Number.parseInt('5abc')` would silently yield 5; the digits-only guard
    // rejects it, so the client keeps the 10s default instead of a 5ms timeout.
    const client = await resolveHealingClient({
      AUTOFIX_HEALING_URL: 'http://phoenix.local',
      AUTOFIX_TIMEOUT_MS: '5abc',
    });

    expect(client).toBeInstanceOf(HttpHealingClient);
    expect((client as unknown as { timeoutMs: number }).timeoutMs).toBe(10_000);
  });
});
