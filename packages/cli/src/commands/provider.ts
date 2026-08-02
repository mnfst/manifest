import { CliIo, clientFromFlags, printJson } from '../context';
import { CliError } from '../errors';
import { slugifyAgentName } from '../slug';
import { parseArgs, requireYes } from '../args';
import { readCredential } from '../secrets';
import { PROVIDER_CATALOG } from '../provider-catalog.gen';

/**
 * Lists what CAN be connected — no auth, no network. Aliases stay internal
 * (they feed resolveProviderId); the output is id + displayName + authTypes.
 */
export async function providerCatalog(io: CliIo, argv: string[]): Promise<void> {
  parseArgs(argv, {});
  printJson(io, {
    providers: PROVIDER_CATALOG.map(({ id, displayName, authTypes }) => ({
      id,
      displayName,
      authTypes,
    })),
  });
}

/**
 * Resolve a --provider value to its canonical id, accepting aliases
 * ("google" → gemini). Unknown values fail before any network call.
 */
export function resolveProviderId(input: string): string {
  const needle = input.trim().toLowerCase();
  const hit = PROVIDER_CATALOG.find((p) => p.id === needle || (p.aliases ?? []).includes(needle));
  if (!hit) {
    throw new CliError(
      'unknown_provider',
      `Unknown provider: ${input}`,
      'Run mnfst provider catalog to list connectable providers',
    );
  }
  return hit.id;
}

export async function providerList(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url'] });
  const { client } = clientFromFlags(io, args);
  const result = await client.request('GET', '/providers');
  printJson(io, stripProviderNoise(result));
}

/**
 * The providers endpoint carries dashboard-only fields: `model_counts` is the
 * global catalog census (not your connections), `models_fetched_at` and
 * `priority` render freshness/ordering chrome, `key_prefix` decorates the key
 * card. Kept: `cached_model_count` (0 = discovery found nothing, routing will
 * fail on that connection), `is_active`, and `display_name` when set (custom
 * providers have no other human name).
 */
function stripProviderNoise(result: unknown): unknown {
  if (typeof result !== 'object' || result === null) return result;
  const record = { ...(result as Record<string, unknown>) };
  delete record['model_counts'];
  if (!Array.isArray(record['providers'])) return record;
  return {
    ...record,
    providers: record['providers'].map((provider) => {
      if (typeof provider !== 'object' || provider === null) return provider;
      const p = { ...(provider as Record<string, unknown>) };
      if (p['display_name'] === null) delete p['display_name'];
      if (Array.isArray(p['connections'])) {
        p['connections'] = p['connections'].map((conn) => {
          if (typeof conn !== 'object' || conn === null) return conn;
          const c = { ...(conn as Record<string, unknown>) };
          delete c['key_prefix'];
          delete c['priority'];
          delete c['models_fetched_at'];
          return c;
        });
      }
      return p;
    }),
  };
}

/**
 * Take the provider as a positional (`provider connect xai`), tolerating the
 * legacy --provider flag; giving both (or neither) is an error.
 */
function providerFromArgs(args: ReturnType<typeof parseArgs>): string {
  const positional = args.positionals[0];
  const flagged = args.strings['provider'];
  if (positional && flagged) {
    throw new CliError(
      'invalid_flag',
      'Pass the provider once — positional or --provider, not both',
    );
  }
  const input = positional ?? flagged;
  if (!input) {
    throw new CliError(
      'missing_positional',
      'Usage: mnfst provider connect <provider>',
      'Run mnfst provider catalog to list connectable providers',
    );
  }
  return resolveProviderId(input);
}

/**
 * Connecting a provider is tenant-wide (the backend enables it for every
 * agent), but the API path is agent-scoped for model discovery. Any agent
 * yields the same result, so when --agent is omitted the CLI picks one and
 * says which it used.
 */
async function resolveDiscoveryAgent(
  io: CliIo,
  args: ReturnType<typeof parseArgs>,
): Promise<string> {
  const explicit = args.strings['agent'];
  if (explicit) return slugifyAgentName(explicit);
  const { client } = clientFromFlags(io, args);
  const result = (await client.request('GET', '/agents')) as {
    agents?: Array<{ agent_name?: string }>;
  };
  const first = result?.agents?.find((a) => typeof a.agent_name === 'string');
  if (!first?.agent_name) {
    throw new CliError(
      'no_agents',
      'No agent exists yet — connecting a provider needs one for model discovery',
      'Run mnfst agent create --name <name> --platform <p> first',
    );
  }
  return first.agent_name;
}

export async function providerConnect(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'provider', 'agent', 'credential-env', 'label', 'region', 'auth-type'],
    booleans: ['credential-stdin'],
  });
  const provider = providerFromArgs(args);
  const agent = await resolveDiscoveryAgent(io, args);
  const authType = args.strings['auth-type'];

  // API-key providers need a credential; `local` (Ollama) does not.
  const credential =
    authType === 'local'
      ? undefined
      : await readCredential(
          io,
          Boolean(args.booleans['credential-stdin']),
          args.strings['credential-env'],
          'credential',
        );

  const { client } = clientFromFlags(io, args);
  const result = await client.request('POST', `/routing/${encodeURIComponent(agent)}/providers`, {
    body: {
      provider,
      ...(credential !== undefined ? { apiKey: credential } : {}),
      ...(authType ? { authType } : {}),
      ...(args.strings['label'] ? { label: args.strings['label'] } : {}),
      ...(args.strings['region'] ? { region: args.strings['region'] } : {}),
    },
  });
  printJson(
    io,
    typeof result === 'object' && result !== null
      ? { agent, ...(result as Record<string, unknown>) }
      : { agent, result },
  );
}

export async function providerDisconnect(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'provider', 'agent', 'auth-type', 'label'],
    booleans: ['yes'],
  });
  const provider = providerFromArgs(args);
  const agent = await resolveDiscoveryAgent(io, args);
  requireYes(args, `disconnect provider "${provider}" (tenant-wide)`);
  const { client } = clientFromFlags(io, args);
  const result = await client.request(
    'DELETE',
    `/routing/${encodeURIComponent(agent)}/providers/${encodeURIComponent(provider)}`,
    {
      query: {
        authType: args.strings['auth-type'],
        label: args.strings['label'],
      },
    },
  );
  printJson(io, result);
}
