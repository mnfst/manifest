import { CliIo, clientFromFlags, printJson } from '../context';
import { parseArgs } from '../args';
import { resolveDiscoveryAgent, resolveProviderId } from './provider';

interface ModelRow {
  model_name?: string;
  provider?: string;
  auth_type?: string;
  context_window?: unknown;
  input_price_per_token?: unknown;
  output_price_per_token?: unknown;
}

/**
 * Models routable for an agent (union of its enabled provider connections),
 * trimmed to what `routing tier set` needs: id, provider, auth type, context
 * window, and per-token prices. --provider filters (aliases accepted).
 */
export async function modelsList(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'agent', 'provider'] });
  const providerFilter = args.strings['provider']
    ? resolveProviderId(args.strings['provider'])
    : null;
  const agent = await resolveDiscoveryAgent(io, args);
  const { client } = clientFromFlags(io, args);
  const rows = (await client.request(
    'GET',
    `/routing/${encodeURIComponent(agent)}/available-models`,
  )) as unknown;

  const models = (Array.isArray(rows) ? rows : [])
    .filter((m): m is ModelRow => typeof m === 'object' && m !== null)
    .filter((m) => !providerFilter || m.provider === providerFilter)
    .map((m) => ({
      model: m.model_name,
      provider: m.provider,
      auth_type: m.auth_type,
      context_window: m.context_window,
      input_price_per_token: m.input_price_per_token,
      output_price_per_token: m.output_price_per_token,
    }));

  printJson(io, { agent, count: models.length, models });
}
