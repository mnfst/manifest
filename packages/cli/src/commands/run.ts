import { spawn } from 'child_process';
import { slugifyAgentName } from '../slug';
import { CliIo } from '../context';
import { CliError } from '../errors';
import { parseArgs, requireString } from '../args';
import { resolveAgentKey } from './agent';

const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Spawn with inherited stdio; the child owns the terminal until it exits. */
export function defaultSpawn(
  cmd: string,
  args: string[],
  env: Record<string, string | undefined>,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env });
    child.on('error', (error: Error) => {
      reject(
        new CliError(
          'spawn_failed',
          `Could not run ${cmd}: ${error.message}`,
          'Check the command exists and is on PATH',
        ),
      );
    });
    child.on('exit', (code: number | null) => {
      resolve(code ?? 1);
    });
  });
}

/**
 * 1Password-style injection: the child process receives the agent key in its
 * environment; the key never crosses stdout, argv, or any transcript. Usage:
 *   mnfst run --agent <name> [--env VAR] [--url <base>] -- <command...>
 */
export async function runCmd(io: CliIo, argv: string[]): Promise<number> {
  const sep = argv.indexOf('--');
  if (sep === -1) {
    throw new CliError(
      'missing_separator',
      'Usage: mnfst run --agent <name> -- <command...>',
      'Everything after -- runs with the agent key injected',
    );
  }
  const command = argv.slice(sep + 1);
  if (command.length === 0) {
    throw new CliError('missing_command', 'No command given after --');
  }

  const args = parseArgs(argv.slice(0, sep), { strings: ['url', 'agent', 'env'] });
  const agentName = slugifyAgentName(requireString(args, 'agent'));
  const envVar = args.strings['env'] ?? 'MANIFEST_AGENT_KEY';
  if (!ENV_NAME_RE.test(envVar)) {
    throw new CliError('invalid_env_name', `Not a valid environment variable name: ${envVar}`);
  }

  const resolved = await resolveAgentKey(io, args, agentName);
  const childEnv: Record<string, string | undefined> = {
    ...io.env,
    [envVar]: resolved.key,
    MANIFEST_AGENT_URL: `${resolved.origin}/v1`,
  };
  const spawnImpl = io.spawnImpl ?? defaultSpawn;
  return spawnImpl(command[0], command.slice(1), childEnv);
}
