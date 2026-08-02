import { CliIo, clientFromFlags, printJson } from '../context';
import { CliError } from '../errors';
import { parseArgs, requirePositional, requireString, requireYes } from '../args';
import { keyPrefixOf, validateKeyFileDestination, writeKeyFile } from '../secrets';

const URL_ONLY = { strings: ['url'] } as const;

export async function agentList(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url'], booleans: ['include-playground'] });
  const { client } = clientFromFlags(io, args);
  const result = await client.request('GET', '/agents', {
    query: { includePlayground: args.booleans['include-playground'] ? 'true' : undefined },
  });
  printJson(io, stripSparklines(result));
}

/**
 * The agents endpoint bundles per-agent `sparkline` series for the
 * dashboard's mini-charts. Terminal and agent consumers have no use for
 * render-only data, so drop it rather than make every caller skip it.
 */
function stripSparklines(result: unknown): unknown {
  if (typeof result !== 'object' || result === null) return result;
  const record = result as Record<string, unknown>;
  if (!Array.isArray(record['agents'])) return result;
  return {
    ...record,
    agents: record['agents'].map((agent) => {
      if (typeof agent !== 'object' || agent === null) return agent;
      const rest = { ...(agent as Record<string, unknown>) };
      delete rest['sparkline'];
      return rest;
    }),
  };
}

export async function agentCreate(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'name', 'key-file', 'category', 'platform'] });
  const name = requireString(args, 'name');
  const keyFile = validateKeyFileDestination(requireString(args, 'key-file'));
  const { client } = clientFromFlags(io, args);

  const result = (await client.request('POST', '/agents', {
    body: {
      name,
      ...(args.strings['category'] ? { agent_category: args.strings['category'] } : {}),
      ...(args.strings['platform'] ? { agent_platform: args.strings['platform'] } : {}),
    },
  })) as { agent: unknown; apiKey: string };

  writeKeyFile(keyFile, result.apiKey);
  printJson(io, { agent: result.agent, keyPrefix: keyPrefixOf(result.apiKey), keyFile });
}

export async function agentGet(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, URL_ONLY);
  const name = requirePositional(args, 0, '<agent-name>');
  const { client } = clientFromFlags(io, args);
  const result = (await client.request('GET', `/agents/${encodeURIComponent(name)}`)) as {
    agent: unknown | null;
  };
  // The API returns 200 { agent: null } for a missing agent — normalize.
  if (!result.agent) {
    throw new CliError('not_found', `Agent "${name}" not found`, 'See mnfst agent list', 404);
  }
  printJson(io, result);
}

export async function agentUpdate(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'name', 'category', 'platform'] });
  const name = requirePositional(args, 0, '<agent-name>');
  const body: Record<string, string> = {};
  if (args.strings['name']) body['name'] = args.strings['name'];
  if (args.strings['category']) body['agent_category'] = args.strings['category'];
  if (args.strings['platform']) body['agent_platform'] = args.strings['platform'];
  if (Object.keys(body).length === 0) {
    throw new CliError(
      'missing_flag',
      'Nothing to update — pass --name, --category, or --platform',
    );
  }
  const { client } = clientFromFlags(io, args);
  const result = await client.request('PATCH', `/agents/${encodeURIComponent(name)}`, { body });
  printJson(io, result);
}

export async function agentDelete(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url'], booleans: ['yes'] });
  const name = requirePositional(args, 0, '<agent-name>');
  requireYes(args, `delete agent "${name}"`);
  const { client } = clientFromFlags(io, args);
  const result = await client.request('DELETE', `/agents/${encodeURIComponent(name)}`);
  printJson(io, result);
}

export async function agentRotateKey(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'key-file'], booleans: ['yes'] });
  const name = requirePositional(args, 0, '<agent-name>');
  requireYes(args, `rotate the API key of "${name}" (the previous key stops working)`);
  const keyFile = validateKeyFileDestination(requireString(args, 'key-file'));
  const { client } = clientFromFlags(io, args);
  const result = (await client.request(
    'POST',
    `/agents/${encodeURIComponent(name)}/rotate-key`,
  )) as { apiKey: string };
  writeKeyFile(keyFile, result.apiKey);
  printJson(io, { rotated: true, keyPrefix: keyPrefixOf(result.apiKey), keyFile });
}
