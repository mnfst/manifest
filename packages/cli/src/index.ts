import { CliIo } from './context';
import { CliError } from './errors';
import { VERSION } from './version';
import { defaultOpenBrowser } from './oauth-login';
import * as auth from './commands/auth';
import * as agent from './commands/agent';
import * as provider from './commands/provider';
import * as routing from './commands/routing';
import * as analytics from './commands/analytics';

type Handler = (io: CliIo, argv: string[]) => Promise<number | void>;

/**
 * Command registry keyed by the longest verb path. Dispatch tries the
 * 3-word key, then 2-word, then 1-word.
 */
export const COMMANDS: Record<string, Handler> = {
  login: auth.login,
  logout: auth.logout,
  'auth status': auth.authStatus,
  whoami: auth.whoami,
  'config path': auth.configPath,

  'agent list': agent.agentList,
  'agent categories': agent.agentCategories,
  'agent create': agent.agentCreate,
  'agent get': agent.agentGet,
  'agent update': agent.agentUpdate,
  'agent delete': agent.agentDelete,
  'agent rotate-key': agent.agentRotateKey,

  'provider list': provider.providerList,
  'provider connect': provider.providerConnect,
  'provider disconnect': provider.providerDisconnect,

  'routing status': routing.routingStatus,
  'routing tiers': routing.routingTiers,
  'routing tier set': routing.routingTierSet,
  'routing tier clear': routing.routingTierClear,
  'routing fallbacks get': routing.routingFallbacksGet,
  'routing fallbacks set': routing.routingFallbacksSet,
  'routing fallbacks clear': routing.routingFallbacksClear,
  'routing autofix get': routing.routingAutofix.get,
  'routing autofix set': routing.routingAutofix.set,
  'routing recording get': routing.routingRecording.get,
  'routing recording set': routing.routingRecording.set,

  overview: analytics.overview,
  costs: analytics.costs,
  requests: analytics.requests,
};

export const USAGE = `mnfst ${VERSION} — Manifest management CLI (JSON output, agent-first)

Auth
  mnfst login [--token-stdin | --token-env <name>] [--url <base>]   (no flags: browser login)
  mnfst logout [--url <base>]
  mnfst auth status | mnfst whoami | mnfst config path

Agents
  mnfst agent list [--include-playground]
  mnfst agent categories
  mnfst agent create --name <name> --category <personal|app|coding> --key-file <path> [--platform <p>]
  mnfst agent get <name> | mnfst agent update <name> [--name|--category|--platform]
  mnfst agent delete <name> --yes
  mnfst agent rotate-key <name> --key-file <path> --yes

Providers
  mnfst provider list
  mnfst provider connect --provider <slug> --agent <name> (--credential-stdin | --credential-env <name>) [--label <l>] [--region <r>] [--auth-type <a>]
  mnfst provider disconnect --provider <slug> --agent <name> [--auth-type <a>] [--label <l>] --yes

Routing
  mnfst routing status <agent> | mnfst routing tiers <agent>
  mnfst routing tier set <agent> --tier <t> --model <m> --provider <p> [--auth-type <a>] [--key-label <l>]
  mnfst routing tier clear <agent> --tier <t> --yes
  mnfst routing fallbacks get|set|clear <agent> --tier <t> [--models <m1,m2>] [--yes]
  mnfst routing autofix get|set <agent> [--enabled true|false]
  mnfst routing recording get|set <agent> [--enabled true|false]

Analytics (read-only)
  mnfst overview [--range <1h|6h|24h|7d|30d|90d|365d>] [--agent <name>]
  mnfst costs [--range <r>] [--agent <name>]
  mnfst requests [--range <r>] [--agent <name>] [--limit <n>] [--cursor <c>] [--status <s>] [--provider <p>]

Environment: MANIFEST_URL, MANIFEST_API_KEY (overrides stored login)
Credentials are stored per-host in ~/.config/manifest/config.json (mode 0600).`;

export function resolveCommand(
  argv: readonly string[],
): { handler: Handler; rest: string[] } | null {
  for (let words = Math.min(3, argv.length); words >= 1; words--) {
    const key = argv.slice(0, words).join(' ');
    // hasOwnProperty guard: `key in COMMANDS` would also match prototype
    // members like "toString".
    const handler = Object.prototype.hasOwnProperty.call(COMMANDS, key) ? COMMANDS[key] : undefined;
    if (handler) return { handler, rest: argv.slice(words) };
  }
  return null;
}

export async function run(io: CliIo, argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === 'help') {
    io.stdout(USAGE);
    return 0;
  }
  if (argv[0] === '--version') {
    io.stdout(JSON.stringify({ version: VERSION }));
    return 0;
  }
  const resolved = resolveCommand(argv);
  if (!resolved) {
    io.stdout(
      JSON.stringify(
        {
          error: 'unknown_command',
          message: `Unknown command: ${argv.join(' ')}`,
          hint: 'Run mnfst --help',
        },
        null,
        2,
      ),
    );
    return 1;
  }
  try {
    const code = await resolved.handler(io, resolved.rest);
    return code ?? 0;
  } catch (error) {
    if (error instanceof CliError) {
      io.stdout(JSON.stringify(error.toJSON(), null, 2));
      return 1;
    }
    io.stdout(
      JSON.stringify(
        {
          error: 'internal_error',
          message: error instanceof Error ? error.message : String(error),
          hint: 'This is a mnfst CLI bug — please report it',
        },
        null,
        2,
      ),
    );
    return 1;
  }
}

/**
 * Entry point used by bin/mnfst.js — pure process wiring, excluded from
 * coverage like the backend's main.ts.
 */
/* istanbul ignore next */
export async function main(argv: string[]): Promise<number> {
  const io: CliIo = {
    env: process.env,
    fetchImpl: fetch,
    stdout: (line) => process.stdout.write(line + '\n'),
    stderr: (line) => process.stderr.write(line + '\n'),
    readStdin: async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf8');
    },
    isTTY: Boolean(process.stderr.isTTY),
    openBrowser: defaultOpenBrowser,
  };
  return run(io, argv);
}
