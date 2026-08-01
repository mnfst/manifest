import { ApiClient } from './client';
import {
  CliConfig,
  Env,
  configFilePath,
  loadConfig,
  resolveTarget,
  ResolvedTarget,
} from './config';
import { CliError } from './errors';
import { ParsedArgs } from './args';

/**
 * Everything a command touches from the outside world, injected so tests can
 * run commands hermetically.
 */
export interface CliIo {
  env: Env;
  fetchImpl: typeof fetch;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  readStdin: () => Promise<string>;
}

export function getConfigPath(io: CliIo): string {
  return configFilePath(io.env);
}

export function getConfig(io: CliIo): CliConfig {
  return loadConfig(getConfigPath(io));
}

export function resolveFromFlags(io: CliIo, args: ParsedArgs): ResolvedTarget {
  return resolveTarget(args.strings['url'], io.env, getConfig(io));
}

/** Build an authenticated client, failing closed when no credential resolves. */
export function clientFromFlags(
  io: CliIo,
  args: ParsedArgs,
): { client: ApiClient; target: ResolvedTarget } {
  const target = resolveFromFlags(io, args);
  if (!target.apiKey) {
    throw new CliError(
      'not_authenticated',
      `No credential for ${target.origin}`,
      'Run mnfst login (--token-stdin or --token-env <name>), or set MANIFEST_API_KEY',
      401,
    );
  }
  return {
    client: new ApiClient({
      origin: target.origin,
      apiKey: target.apiKey,
      fetchImpl: io.fetchImpl,
    }),
    target,
  };
}

export function printJson(io: CliIo, value: unknown): void {
  io.stdout(JSON.stringify(value, null, 2));
}
