import { ApiClient } from '../client';
import { CliIo, clientFromFlags, printJson } from '../context';
import { CliError } from '../errors';
import { parseArgs, parseBooleanFlag, requirePositional, requireString } from '../args';
import { slugifyAgentName } from '../slug';
import { assertModelsDiscovered } from './model-check';

function agentPath(agent: string, suffix: string): string {
  return `/routing/${encodeURIComponent(agent)}${suffix}`;
}

/**
 * The human front door for agent configuration — one verb, one line:
 *
 *   mnfst agent configure <name> --models <primary,fb1,fb2> --provider <p>
 *   mnfst agent configure <name> --tier test --models <primary> --provider <p>
 *   mnfst agent configure <name> --autofix true --recording false
 *
 * --models is the FULL desired chain: first entry is the route, the rest are
 * fallbacks, and stating a single model clears any existing fallbacks.
 * Without --tier the DEFAULT route changes; with --tier <name> the named
 * custom header tier is upserted (created on first use, updated after).
 *
 * Every named model is checked against the agent's discovered models before
 * anything is written; --force skips that check.
 */
export async function agentConfigure(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: [
      'url',
      'models',
      'provider',
      'auth-type',
      'key-label',
      'tier',
      'autofix',
      'recording',
    ],
    booleans: ['force'],
  });
  const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));

  const wantsRoute = Boolean(args.strings['models'] || args.strings['provider']);
  const wantsAutofix = args.strings['autofix'] !== undefined;
  const wantsRecording = args.strings['recording'] !== undefined;
  if (!wantsRoute && !wantsAutofix && !wantsRecording) {
    throw new CliError(
      'missing_flag',
      'Nothing to configure — pass --models + --provider, --autofix, and/or --recording',
    );
  }
  if (args.strings['tier'] && !wantsRoute) {
    throw new CliError('missing_flag', '--tier needs --models and --provider');
  }

  const { client } = clientFromFlags(io, args);
  const output: Record<string, unknown> = { agent };

  if (wantsRoute) {
    const models = requireString(args, 'models')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (models.length === 0) {
      throw new CliError('missing_flag', '--models must be a comma-separated list of model ids');
    }
    const provider = requireString(args, 'provider');
    await assertModelsDiscovered(client, agent, models, Boolean(args.booleans['force']));
    const route = {
      model: models[0],
      provider,
      authType: args.strings['auth-type'] ?? 'api_key',
      ...(args.strings['key-label'] ? { providerKeyLabel: args.strings['key-label'] } : {}),
    };
    const fallbacks = models.slice(1);

    if (args.strings['tier']) {
      const tier = await upsertCustomTier(client, agent, args.strings['tier']);
      output['tier'] = tier;
      output['route'] = await client.request(
        'PUT',
        agentPath(agent, `/header-tiers/${encodeURIComponent(tier.id)}/override`),
        { body: route },
      );
      output['fallbacks'] = await setOrClearFallbacks(
        client,
        agentPath(agent, `/header-tiers/${encodeURIComponent(tier.id)}/fallbacks`),
        fallbacks,
      );
    } else {
      output['route'] = await client.request('PUT', agentPath(agent, '/tiers/default'), {
        body: route,
      });
      output['fallbacks'] = await setOrClearFallbacks(
        client,
        agentPath(agent, '/tiers/default/fallbacks'),
        fallbacks,
      );
    }
  }

  if (wantsAutofix) {
    const enabled = parseBooleanFlag(args.strings['autofix'] as string, 'autofix');
    output['autofix'] = await client.request('PATCH', agentPath(agent, '/autofix'), {
      body: { enabled },
    });
  }
  if (wantsRecording) {
    const enabled = parseBooleanFlag(args.strings['recording'] as string, 'recording');
    output['recording'] = await client.request('PATCH', agentPath(agent, '/recording'), {
      body: { enabled },
    });
  }

  printJson(io, output);
}

/** --models states the whole chain: extra entries set fallbacks, a lone entry clears them. */
async function setOrClearFallbacks(
  client: ApiClient,
  path: string,
  fallbacks: string[],
): Promise<unknown> {
  if (fallbacks.length > 0) {
    return client.request('PUT', path, { body: { models: fallbacks } });
  }
  await client.request('DELETE', path);
  return [];
}

async function upsertCustomTier(
  client: ApiClient,
  agent: string,
  name: string,
): Promise<{ id: string; name: string; created: boolean }> {
  const rows = (await client.request('GET', agentPath(agent, '/header-tiers'))) as unknown;
  const list = (Array.isArray(rows) ? rows : []).filter(
    (t): t is { id?: string; name?: string } => typeof t === 'object' && t !== null,
  );
  const needle = name.toLowerCase();
  const hit = list.find((t) => typeof t.name === 'string' && t.name.toLowerCase() === needle);
  if (hit?.id) return { id: hit.id, name: hit.name as string, created: false };

  const created = (await client.request('POST', agentPath(agent, '/header-tiers'), {
    body: {
      name,
      header_key: 'x-manifest-tier',
      header_value: name,
      badge_color: 'indigo',
    },
  })) as { id: string };
  return { id: created.id, name, created: true };
}
