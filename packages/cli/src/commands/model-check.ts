import { ApiClient } from '../client';
import { CliError } from '../errors';

/** The agent's discovered model ids — the union of its ENABLED connections. */
async function discoveredModels(client: ApiClient, agent: string): Promise<Set<string>> {
  const rows = (await client.request(
    'GET',
    `/routing/${encodeURIComponent(agent)}/available-models`,
  )) as unknown;
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map((m) =>
        typeof m === 'object' && m !== null
          ? (m as { model_name?: unknown }).model_name
          : undefined,
      )
      .filter((name): name is string => typeof name === 'string'),
  );
}

/**
 * One gate for every command that writes a route: a model the agent cannot
 * see is a typo or a hollow connection, and catching it here beats finding
 * out on live traffic. Shared by `agent configure` and `routing custom
 * create` so the two can never drift.
 *
 * `force` skips the check — the backend still routes an uncatalogued model
 * through provider-qualified passthrough, so the CLI must not be the thing
 * that makes a brand-new model unusable.
 */
export async function assertModelsDiscovered(
  client: ApiClient,
  agent: string,
  models: readonly string[],
  force: boolean,
): Promise<void> {
  if (force) return;
  const known = await discoveredModels(client, agent);
  const missing = models.filter((m) => !known.has(m));
  if (missing.length === 0) return;
  throw new CliError(
    'unknown_model',
    `Not in the models discovered for "${agent}": ${missing.join(', ')}`,
    `The catalog may be stale or empty — rediscover with mnfst provider refresh (and check mnfst models ${agent}); or pass --force to write the route anyway (the backend supports provider-qualified passthrough for uncatalogued models)`,
  );
}
