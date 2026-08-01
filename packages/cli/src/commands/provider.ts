import { CliIo, clientFromFlags, printJson } from '../context';
import { parseArgs, requireString, requireYes } from '../args';
import { readCredential } from '../secrets';

export async function providerList(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url'] });
  const { client } = clientFromFlags(io, args);
  const result = await client.request('GET', '/providers');
  printJson(io, result);
}

/**
 * Provider credentials are tenant-global, but connect/disconnect currently
 * live under an agent-scoped API path (model discovery runs through that
 * agent). The CLI therefore requires an explicit --agent — it never picks
 * one silently. A tenant-level API contract is the planned follow-up.
 */
export async function providerConnect(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'provider', 'agent', 'credential-env', 'label', 'region', 'auth-type'],
    booleans: ['credential-stdin'],
  });
  const provider = requireString(args, 'provider');
  const agent = requireString(args, 'agent');
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
  printJson(io, result);
}

export async function providerDisconnect(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'provider', 'agent', 'auth-type', 'label'],
    booleans: ['yes'],
  });
  const provider = requireString(args, 'provider');
  const agent = requireString(args, 'agent');
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
