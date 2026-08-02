import * as readline from 'readline';
import { Writable } from 'stream';
import { CliIo } from './context';
import { CliError } from './errors';
import { VERSION } from './version';
import { defaultOpenBrowser } from './oauth-login';
import * as auth from './commands/auth';
import * as agent from './commands/agent';
import * as provider from './commands/provider';
import * as routing from './commands/routing';
import * as runCommand from './commands/run';
import * as models from './commands/models';
import * as configure from './commands/configure';
import * as requests from './commands/requests';

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
  'agent platforms': agent.agentPlatforms,
  'agent create': agent.agentCreate,
  'agent env': agent.agentEnv,
  'agent key path': agent.agentKeyPathCmd,
  'agent key show': agent.agentKeyShow,
  'agent configure': configure.agentConfigure,
  'agent get': agent.agentGet,
  'agent update': agent.agentUpdate,
  'agent delete': agent.agentDelete,
  'agent rotate-key': agent.agentRotateKey,

  'provider list': provider.providerList,
  'provider catalog': provider.providerCatalog,
  'provider connect': provider.providerConnect,
  'provider disconnect': provider.providerDisconnect,

  'routing status': routing.routingStatus,
  'routing test': routing.routingTest,
  'routing fallbacks get': routing.routingFallbacksGet,
  'routing fallbacks clear': routing.routingFallbacksClear,
  'routing custom list': routing.routingCustom.list,
  'routing custom create': routing.routingCustom.create,
  'routing custom delete': routing.routingCustom.delete,
  'routing autofix get': routing.routingAutofix.get,
  'routing autofix set': routing.routingAutofix.set,
  'routing recording get': routing.routingRecording.get,
  'routing recording set': routing.routingRecording.set,

  'requests get': requests.requestsGet,

  run: runCommand.runCmd,

  models: models.modelsList,
};

export const USAGE = `mnfst ${VERSION} — Manifest management CLI (JSON output, agent-first)

Auth
  mnfst login [--token-stdin | --token-env <name>] [--url <base>]   (no flags: browser login)
  mnfst logout [--url <base>]
  mnfst auth status | mnfst whoami | mnfst config path

Agents
  mnfst agent list [--include-playground]
  mnfst agent platforms
  mnfst agent create --name <name> --platform <p> [--category <personal|app|coding>] [--key-file <path>] [--if-absent]
  mnfst agent configure <name> --models <primary,fb1,fb2> --provider <p> [--auth-type <a>] [--tier <custom>] [--autofix true|false] [--recording true|false]
    (--models is the full chain: first = route, rest = fallbacks, one entry clears fallbacks;
     default route unless --tier names a custom tier, upserted on "x-manifest-tier: <name>")
  mnfst agent env <name> [--export]                     (dotenv/shell lines: KEY + URL; append to .env or eval)
  mnfst agent key path <name> | mnfst agent key show <name>
  mnfst agent get <name> | mnfst agent update <name> [--name|--category|--platform]
  mnfst agent delete <name> --yes
  mnfst agent rotate-key <name> --yes [--key-file <path>]

Providers
  mnfst provider list [--agent <name>]                 (connections; --agent annotates enabled per agent)
  mnfst provider catalog                               (everything connectable: ids + auth types)
  mnfst provider connect <provider> [--credential-stdin | --credential-env <name>] [--agent <name>] [--label <l>] [--region <r>] [--auth-type <a>]
    (interactive terminals are prompted for the key, input hidden; agent auto-picked — the connection is tenant-wide)
  mnfst provider disconnect <provider> --yes [--agent <name>] [--auth-type <a>] [--label <l>]

Models
  mnfst models <agent> [--provider <p>] [--cost] [--capabilities]   (like /v1/models: bare ids; flags opt into metadata)

Routing readouts + custom-tier lifecycle (writes go through mnfst agent configure)
  mnfst routing status <agent>
  mnfst routing test <agent> [prompt...] [--tier <t>] [--model <m>]   (one real request through the route; fails loudly)
  mnfst routing fallbacks get|clear <agent> [--yes]
  mnfst routing custom list <agent>
  mnfst routing custom create <agent> --name <n> --model <m> --provider <p> [--auth-type <a>] [--fallbacks <m1,m2>] [--header-key <k>] [--header-value <v>]
  mnfst routing custom delete <agent> <name> --yes
  mnfst routing autofix get|set <agent> [--enabled true|false]
  mnfst routing recording get|set <agent> [--enabled true|false]

Requests (paginated, mirrors the API: opaque cursor, one page per call)
  mnfst requests get [--agent <name>] [--range <r>] [--status <s>] [--provider <p>] [--origin <o>] [--limit <1-200>] [--cursor <c>] [--full]

Run (key injection, 1Password-style)
  mnfst run --agent <name> [--env <VAR>] -- <command...>
    Runs the command with the agent's key injected as MANIFEST_AGENT_KEY (or <VAR>) plus
    MANIFEST_AGENT_URL (already ends in /v1 — append /chat/completions directly).
    The key never crosses stdout or your transcript.

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
    readLine: (promptText) =>
      new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
        rl.question(promptText, (answer) => {
          rl.close();
          resolve(answer);
        });
      }),
    readSecret: (promptText) =>
      new Promise((resolve) => {
        process.stderr.write(promptText);
        const muted = new Writable({ write: (_c, _e, cb) => cb() });
        const rl = readline.createInterface({
          input: process.stdin,
          output: muted,
          terminal: true,
        });
        rl.question('', (answer) => {
          rl.close();
          process.stderr.write('\n');
          resolve(answer);
        });
      }),
  };
  return run(io, argv);
}
