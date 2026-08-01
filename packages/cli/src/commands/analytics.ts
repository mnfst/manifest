import { CliIo, clientFromFlags, printJson } from '../context';
import { parseArgs } from '../args';

export async function overview(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'range', 'agent'] });
  const { client } = clientFromFlags(io, args);
  const result = await client.request('GET', '/overview', {
    query: { range: args.strings['range'], agent_name: args.strings['agent'] },
  });
  printJson(io, result);
}

export async function costs(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'range', 'agent'] });
  const { client } = clientFromFlags(io, args);
  const result = await client.request('GET', '/costs', {
    query: { range: args.strings['range'], agent_name: args.strings['agent'] },
  });
  printJson(io, result);
}

export async function requests(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'range', 'agent', 'limit', 'cursor', 'status', 'provider'],
  });
  const { client } = clientFromFlags(io, args);
  const result = await client.request('GET', '/messages', {
    query: {
      range: args.strings['range'],
      agent_name: args.strings['agent'],
      limit: args.strings['limit'],
      cursor: args.strings['cursor'],
      status: args.strings['status'],
      provider: args.strings['provider'],
    },
  });
  printJson(io, result);
}
