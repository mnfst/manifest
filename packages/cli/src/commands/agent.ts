import { CliIo, clientFromFlags, printJson } from '../context';
import { CliError } from '../errors';
import { ParsedArgs, parseArgs, requirePositional, requireString, requireYes } from '../args';
import { keyPrefixOf, validateKeyFileDestination, writeKeyFile } from '../secrets';
import { agentKeyPath, readAgentKey, saveAgentKey } from '../keystore';

const URL_ONLY = { strings: ['url'] } as const;

/**
 * Mirrors AGENT_PLATFORMS in manifest-shared (the backend rejects anything
 * else). The platform drives the agent's setup instructions, so create makes
 * it mandatory. Kept as a literal so the CLI stays zero-runtime-dependency;
 * a drift guard in commands.spec.ts pins it against the shared package.
 */
export const CLI_AGENT_PLATFORMS = [
  'openclaw',
  'hermes',
  'nanobot',
  'craft',
  'claude-code',
  'opencode',
  'openai-sdk',
  'anthropic-sdk',
  'vercel-ai-sdk',
  'langchain',
  'curl',
  'other',
] as const;

function requirePlatform(args: ParsedArgs): string {
  const list = CLI_AGENT_PLATFORMS.join(', ');
  const value = args.strings['platform'];
  if (!value) {
    throw new CliError(
      'missing_platform',
      `--platform is required (it determines the agent setup). Valid platforms: ${list}`,
      'Run mnfst agent platforms to list them',
    );
  }
  if (!(CLI_AGENT_PLATFORMS as readonly string[]).includes(value)) {
    throw new CliError(
      'invalid_platform',
      `Unknown platform: ${value}. Valid platforms: ${list}`,
      'Run mnfst agent platforms to list them',
    );
  }
  return value;
}

export async function agentPlatforms(io: CliIo, argv: string[]): Promise<void> {
  parseArgs(argv, {});
  printJson(io, { platforms: [...CLI_AGENT_PLATFORMS] });
}

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
  const platform = requirePlatform(args);
  // --key-file is an explicit override; the default home is the managed
  // keystore, so nobody has to invent a path to avoid printing a secret.
  const keyFile = args.strings['key-file']
    ? validateKeyFileDestination(args.strings['key-file'])
    : null;
  const { client, target } = clientFromFlags(io, args);

  const result = (await client.request('POST', '/agents', {
    body: {
      name,
      agent_platform: platform,
      ...(args.strings['category'] ? { agent_category: args.strings['category'] } : {}),
    },
  })) as { agent: unknown; apiKey: string };

  if (keyFile) {
    writeKeyFile(keyFile, result.apiKey);
    printJson(io, { agent: result.agent, keyPrefix: keyPrefixOf(result.apiKey), keyFile });
    return;
  }
  const keyPath = saveAgentKey(io.env, target.origin, name, result.apiKey);
  printJson(io, { agent: result.agent, keyPrefix: keyPrefixOf(result.apiKey), keyPath });
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
  const keyFile = args.strings['key-file']
    ? validateKeyFileDestination(args.strings['key-file'])
    : null;
  const { client, target } = clientFromFlags(io, args);
  const result = (await client.request(
    'POST',
    `/agents/${encodeURIComponent(name)}/rotate-key`,
  )) as { apiKey: string };
  if (keyFile) {
    writeKeyFile(keyFile, result.apiKey);
    printJson(io, { rotated: true, keyPrefix: keyPrefixOf(result.apiKey), keyFile });
    return;
  }
  const keyPath = saveAgentKey(io.env, target.origin, name, result.apiKey);
  printJson(io, { rotated: true, keyPrefix: keyPrefixOf(result.apiKey), keyPath });
}

/**
 * Resolve an agent's key: keystore first, else recover the server's copy and
 * re-cache it. Returns the raw key and where it came from.
 */
export async function resolveAgentKey(
  io: CliIo,
  args: ParsedArgs,
  name: string,
): Promise<{ key: string; path: string; origin: string; source: 'keystore' | 'server' }> {
  const { client, target } = clientFromFlags(io, args);
  const cached = readAgentKey(io.env, target.origin, name);
  if (cached) {
    return {
      key: cached,
      path: agentKeyPath(io.env, target.origin, name),
      origin: target.origin,
      source: 'keystore',
    };
  }
  const result = (await client.request('GET', `/agents/${encodeURIComponent(name)}/key`)) as {
    keyPrefix: string;
    apiKey?: string;
  };
  if (!result.apiKey) {
    throw new CliError(
      'key_unrecoverable',
      `The server cannot recover the key for "${name}"`,
      `Run mnfst agent rotate-key ${name} --yes to mint a fresh one`,
    );
  }
  const path = saveAgentKey(io.env, target.origin, name, result.apiKey);
  return { key: result.apiKey, path, origin: target.origin, source: 'server' };
}

export async function agentKeyPathCmd(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, URL_ONLY);
  const name = requirePositional(args, 0, '<agent-name>');
  const resolved = await resolveAgentKey(io, args, name);
  printJson(io, { agent: name, path: resolved.path, source: resolved.source });
}

/** Prints the raw key — the one deliberate, greppable way to surface it. */
export async function agentKeyShow(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, URL_ONLY);
  const name = requirePositional(args, 0, '<agent-name>');
  const resolved = await resolveAgentKey(io, args, name);
  printJson(io, { agent: name, apiKey: resolved.key });
}
