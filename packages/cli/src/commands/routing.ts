import { CliIo, clientFromFlags, printJson } from '../context';
import { CliError } from '../errors';
import { parseArgs, parseBooleanFlag, requirePositional, requireString, requireYes } from '../args';

const URL_ONLY = { strings: ['url'] } as const;

function agentPath(agent: string, suffix: string): string {
  return `/routing/${encodeURIComponent(agent)}${suffix}`;
}

export async function routingStatus(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, URL_ONLY);
  const agent = requirePositional(args, 0, '<agent-name>');
  const { client } = clientFromFlags(io, args);
  printJson(io, await client.request('GET', agentPath(agent, '/status')));
}

export async function routingTiers(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, URL_ONLY);
  const agent = requirePositional(args, 0, '<agent-name>');
  const { client } = clientFromFlags(io, args);
  printJson(io, await client.request('GET', agentPath(agent, '/tiers')));
}

export async function routingTierSet(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'tier', 'model', 'provider', 'auth-type', 'key-label'],
  });
  const agent = requirePositional(args, 0, '<agent-name>');
  const tier = requireString(args, 'tier');
  const model = requireString(args, 'model');
  const provider = requireString(args, 'provider');
  const { client } = clientFromFlags(io, args);
  const result = await client.request(
    'PUT',
    agentPath(agent, `/tiers/${encodeURIComponent(tier)}`),
    {
      body: {
        model,
        provider,
        authType: args.strings['auth-type'] ?? 'api_key',
        ...(args.strings['key-label'] ? { providerKeyLabel: args.strings['key-label'] } : {}),
      },
    },
  );
  printJson(io, result);
}

export async function routingTierClear(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'tier'], booleans: ['yes'] });
  const agent = requirePositional(args, 0, '<agent-name>');
  const tier = requireString(args, 'tier');
  requireYes(args, `clear the ${tier} tier override of "${agent}"`);
  const { client } = clientFromFlags(io, args);
  printJson(
    io,
    await client.request('DELETE', agentPath(agent, `/tiers/${encodeURIComponent(tier)}`)),
  );
}

export async function routingFallbacksGet(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'tier'] });
  const agent = requirePositional(args, 0, '<agent-name>');
  const tier = requireString(args, 'tier');
  const { client } = clientFromFlags(io, args);
  printJson(
    io,
    await client.request('GET', agentPath(agent, `/tiers/${encodeURIComponent(tier)}/fallbacks`)),
  );
}

export async function routingFallbacksSet(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'tier', 'models'] });
  const agent = requirePositional(args, 0, '<agent-name>');
  const tier = requireString(args, 'tier');
  const models = requireString(args, 'models')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (models.length === 0) {
    throw new CliError('missing_flag', '--models must be a comma-separated list of model ids');
  }
  const { client } = clientFromFlags(io, args);
  const result = await client.request(
    'PUT',
    agentPath(agent, `/tiers/${encodeURIComponent(tier)}/fallbacks`),
    {
      body: { models },
    },
  );
  printJson(io, result);
}

export async function routingFallbacksClear(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'tier'], booleans: ['yes'] });
  const agent = requirePositional(args, 0, '<agent-name>');
  const tier = requireString(args, 'tier');
  requireYes(args, `clear the ${tier} tier fallbacks of "${agent}"`);
  const { client } = clientFromFlags(io, args);
  printJson(
    io,
    await client.request(
      'DELETE',
      agentPath(agent, `/tiers/${encodeURIComponent(tier)}/fallbacks`),
    ),
  );
}

function toggleCommand(feature: 'autofix' | 'recording') {
  return {
    get: async (io: CliIo, argv: string[]): Promise<void> => {
      const args = parseArgs(argv, URL_ONLY);
      const agent = requirePositional(args, 0, '<agent-name>');
      const { client } = clientFromFlags(io, args);
      printJson(io, await client.request('GET', agentPath(agent, `/${feature}`)));
    },
    set: async (io: CliIo, argv: string[]): Promise<void> => {
      const args = parseArgs(argv, { strings: ['url', 'enabled'] });
      const agent = requirePositional(args, 0, '<agent-name>');
      const enabled = parseBooleanFlag(requireString(args, 'enabled'), 'enabled');
      const { client } = clientFromFlags(io, args);
      printJson(
        io,
        await client.request('PATCH', agentPath(agent, `/${feature}`), { body: { enabled } }),
      );
    },
  };
}

export const routingAutofix = toggleCommand('autofix');
export const routingRecording = toggleCommand('recording');
