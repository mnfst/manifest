import { CliIo, clientFromFlags, printJson } from '../context';
import { CliError } from '../errors';
import { parseArgs } from '../args';
import { slugifyAgentName } from '../slug';

/**
 * Paginated read of the Requests log, mirroring the real API contract
 * (GET /api/v1/messages): opaque `cursor` + `next_cursor`, server-capped
 * `limit`. One page per invocation — callers (and agents) page explicitly:
 *
 *   mnfst requests get --agent john --limit 50
 *   mnfst requests get --agent john --cursor <next_cursor from last page>
 */
export async function requestsGet(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'agent', 'range', 'status', 'provider', 'limit', 'cursor', 'origin'],
  });
  let limit: number | undefined;
  if (args.strings['limit'] !== undefined) {
    limit = Number.parseInt(args.strings['limit'], 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new CliError('invalid_flag', '--limit must be an integer between 1 and 200');
    }
  }
  const agent = args.strings['agent'] ? slugifyAgentName(args.strings['agent']) : undefined;
  const { client } = clientFromFlags(io, args);
  const result = (await client.request('GET', '/messages', {
    query: {
      agent_name: agent,
      range: args.strings['range'],
      status: args.strings['status'],
      provider: args.strings['provider'],
      origin: args.strings['origin'],
      limit: limit !== undefined ? String(limit) : undefined,
      cursor: args.strings['cursor'],
    },
  })) as {
    items?: unknown[];
    next_cursor?: string | null;
    total_count?: number;
    total_count_exact?: boolean;
  } | null;

  const items = Array.isArray(result?.items) ? result.items : [];
  printJson(io, {
    ...(agent ? { agent } : {}),
    count: items.length,
    // Faithful pagination: hand back the API's cursor; null means last page.
    next_cursor: result?.next_cursor ?? null,
    total_count: result?.total_count,
    total_count_exact: result?.total_count_exact,
    requests: items,
  });
}
