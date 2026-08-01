import { ApiClient } from '../client';
import { loadConfig, normalizeOrigin, saveConfig, DEFAULT_URL } from '../config';
import { CliIo, clientFromFlags, getConfigPath, printJson, resolveFromFlags } from '../context';
import { parseArgs } from '../args';
import { readCredential } from '../secrets';

interface MeResponse {
  tenantId: string | null;
  userId: string | null;
  authMethod: string | null;
}

const LOGIN_FLAGS = { strings: ['token-env', 'url'], booleans: ['token-stdin'] } as const;

export async function login(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, LOGIN_FLAGS);
  const token = await readCredential(
    io,
    Boolean(args.booleans['token-stdin']),
    args.strings['token-env'],
    'token',
  );
  const origin = normalizeOrigin(args.strings['url'] ?? io.env['MANIFEST_URL'] ?? DEFAULT_URL);

  const client = new ApiClient({ origin, apiKey: token, fetchImpl: io.fetchImpl });
  const me = (await client.request('GET', '/me')) as MeResponse;

  const configPath = getConfigPath(io);
  const config = loadConfig(configPath);
  config.hosts = { ...config.hosts, [origin]: { apiKey: token } };
  config.activeHost = origin;
  saveConfig(configPath, config);

  printJson(io, {
    authenticated: true,
    url: origin,
    tenantId: me.tenantId,
    userId: me.userId,
    authMethod: me.authMethod,
    source: 'config',
  });
}

export async function logout(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url'] });
  const configPath = getConfigPath(io);
  const config = loadConfig(configPath);
  const origin = normalizeOrigin(
    args.strings['url'] ?? io.env['MANIFEST_URL'] ?? config.activeHost ?? DEFAULT_URL,
  );

  const existed = Boolean(config.hosts?.[origin]);
  if (config.hosts) delete config.hosts[origin];
  if (config.activeHost === origin) delete config.activeHost;
  saveConfig(configPath, config);

  printJson(io, { loggedOut: existed, url: origin });
}

export async function authStatus(io: CliIo, argv: string[]): Promise<number | void> {
  const args = parseArgs(argv, { strings: ['url'] });
  const target = resolveFromFlags(io, args);
  if (!target.apiKey) {
    printJson(io, {
      authenticated: false,
      url: target.origin,
      hint: 'Run mnfst login (--token-stdin or --token-env <name>), or set MANIFEST_API_KEY',
    });
    return 1;
  }
  const client = new ApiClient({
    origin: target.origin,
    apiKey: target.apiKey,
    fetchImpl: io.fetchImpl,
  });
  const me = (await client.request('GET', '/me')) as MeResponse;
  printJson(io, {
    authenticated: true,
    url: target.origin,
    source: target.source,
    tenantId: me.tenantId,
    userId: me.userId,
    authMethod: me.authMethod,
  });
}

export async function whoami(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url'] });
  const { client, target } = clientFromFlags(io, args);
  const me = (await client.request('GET', '/me')) as MeResponse;
  printJson(io, { url: target.origin, ...me });
}

export async function configPath(io: CliIo, argv: string[]): Promise<void> {
  parseArgs(argv, {});
  printJson(io, { path: getConfigPath(io) });
}
