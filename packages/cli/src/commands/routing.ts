import { CliIo, clientFromFlags, printJson } from '../context';
import { slugifyAgentName } from '../slug';
import { CliError } from '../errors';
import { parseArgs, parseBooleanFlag, requirePositional, requireString, requireYes } from '../args';
import { ApiClient } from '../client';

const URL_ONLY = { strings: ['url'] } as const;

/**
 * The CLI exposes only the routing surfaces Manifest keeps long-term:
 * the DEFAULT route (one model + fallbacks) and CUSTOM header-triggered
 * tiers. The deprecated complexity tiers (simple/standard/complex/reasoning)
 * are deliberately absent.
 */

function agentPath(agent: string, suffix: string): string {
  return `/routing/${encodeURIComponent(agent)}${suffix}`;
}

function parseModelsList(raw: string): string[] {
  const models = raw
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (models.length === 0) {
    throw new CliError('missing_flag', '--fallbacks must be a comma-separated list of model ids');
  }
  return models;
}

export async function routingStatus(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, URL_ONLY);
  const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
  const { client } = clientFromFlags(io, args);
  printJson(io, await client.request('GET', agentPath(agent, '/status')));
}

/** One command for the whole default route: model + optional fallbacks. */
export async function routingSet(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'model', 'provider', 'auth-type', 'key-label', 'fallbacks'],
  });
  const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
  const model = requireString(args, 'model');
  const provider = requireString(args, 'provider');
  const { client } = clientFromFlags(io, args);
  const route = await client.request('PUT', agentPath(agent, '/tiers/default'), {
    body: {
      model,
      provider,
      authType: args.strings['auth-type'] ?? 'api_key',
      ...(args.strings['key-label'] ? { providerKeyLabel: args.strings['key-label'] } : {}),
    },
  });
  let fallbacks: unknown;
  if (args.strings['fallbacks']) {
    fallbacks = await client.request('PUT', agentPath(agent, '/tiers/default/fallbacks'), {
      body: { models: parseModelsList(args.strings['fallbacks']) },
    });
  }
  printJson(io, { agent, route, ...(fallbacks !== undefined ? { fallbacks } : {}) });
}

export async function routingFallbacksGet(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, URL_ONLY);
  const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
  const { client } = clientFromFlags(io, args);
  printJson(io, await client.request('GET', agentPath(agent, '/tiers/default/fallbacks')));
}

export async function routingFallbacksSet(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'models'] });
  const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
  const models = parseModelsList(requireString(args, 'models'));
  const { client } = clientFromFlags(io, args);
  printJson(
    io,
    await client.request('PUT', agentPath(agent, '/tiers/default/fallbacks'), {
      body: { models },
    }),
  );
}

export async function routingFallbacksClear(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url'], booleans: ['yes'] });
  const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
  requireYes(args, `clear the default-route fallbacks of "${agent}"`);
  const { client } = clientFromFlags(io, args);
  printJson(io, await client.request('DELETE', agentPath(agent, '/tiers/default/fallbacks')));
}

interface HeaderTierRow {
  id?: string;
  name?: string;
}

async function findCustomTier(
  client: ApiClient,
  agent: string,
  nameOrId: string,
): Promise<{ id: string; name: string }> {
  const rows = (await client.request('GET', agentPath(agent, '/header-tiers'))) as unknown;
  const list = (Array.isArray(rows) ? rows : []).filter(
    (t): t is HeaderTierRow => typeof t === 'object' && t !== null,
  );
  const needle = nameOrId.toLowerCase();
  const hit = list.find(
    (t) => t.id === nameOrId || (typeof t.name === 'string' && t.name.toLowerCase() === needle),
  );
  if (!hit?.id) {
    throw new CliError(
      'not_found',
      `No custom tier "${nameOrId}" on agent "${agent}"`,
      'See mnfst routing custom list',
      404,
    );
  }
  return { id: hit.id, name: typeof hit.name === 'string' ? hit.name : hit.id };
}

export const routingCustom = {
  list: async (io: CliIo, argv: string[]): Promise<void> => {
    const args = parseArgs(argv, URL_ONLY);
    const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
    const { client } = clientFromFlags(io, args);
    printJson(io, await client.request('GET', agentPath(agent, '/header-tiers')));
  },

  /**
   * Create a custom tier and route it in one command. The tier triggers on
   * `<header-key>: <header-value>` (defaults: x-manifest-tier: <name>), so a
   * caller opts in per request with a single header.
   */
  create: async (io: CliIo, argv: string[]): Promise<void> => {
    const args = parseArgs(argv, {
      strings: [
        'url',
        'name',
        'model',
        'provider',
        'auth-type',
        'fallbacks',
        'header-key',
        'header-value',
      ],
    });
    const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
    const name = requireString(args, 'name');
    const model = requireString(args, 'model');
    const provider = requireString(args, 'provider');
    const { client } = clientFromFlags(io, args);

    const tier = (await client.request('POST', agentPath(agent, '/header-tiers'), {
      body: {
        name,
        header_key: args.strings['header-key'] ?? 'x-manifest-tier',
        header_value: args.strings['header-value'] ?? name,
        badge_color: 'indigo',
      },
    })) as { id: string };

    const route = await client.request(
      'PUT',
      agentPath(agent, `/header-tiers/${encodeURIComponent(tier.id)}/override`),
      {
        body: { model, provider, authType: args.strings['auth-type'] ?? 'api_key' },
      },
    );
    let fallbacks: unknown;
    if (args.strings['fallbacks']) {
      fallbacks = await client.request(
        'PUT',
        agentPath(agent, `/header-tiers/${encodeURIComponent(tier.id)}/fallbacks`),
        { body: { models: parseModelsList(args.strings['fallbacks']) } },
      );
    }
    printJson(io, {
      agent,
      tier,
      route,
      ...(fallbacks !== undefined ? { fallbacks } : {}),
    });
  },

  delete: async (io: CliIo, argv: string[]): Promise<void> => {
    const args = parseArgs(argv, { strings: ['url'], booleans: ['yes'] });
    const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
    const nameOrId = requirePositional(args, 1, '<tier-name-or-id>');
    const { client } = clientFromFlags(io, args);
    const tier = await findCustomTier(client, agent, nameOrId);
    requireYes(args, `delete custom tier "${tier.name}" of "${agent}"`);
    printJson(
      io,
      await client.request(
        'DELETE',
        agentPath(agent, `/header-tiers/${encodeURIComponent(tier.id)}`),
      ),
    );
  },
};

function toggleCommand(feature: 'autofix' | 'recording') {
  return {
    get: async (io: CliIo, argv: string[]): Promise<void> => {
      const args = parseArgs(argv, URL_ONLY);
      const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
      const { client } = clientFromFlags(io, args);
      printJson(io, await client.request('GET', agentPath(agent, `/${feature}`)));
    },
    set: async (io: CliIo, argv: string[]): Promise<void> => {
      const args = parseArgs(argv, { strings: ['url', 'enabled'] });
      const agent = slugifyAgentName(requirePositional(args, 0, '<agent-name>'));
      const enabled = parseBooleanFlag(requireString(args, 'enabled'), 'enabled');
      const { client } = clientFromFlags(io, args);
      printJson(
        io,
        await client.request('PATCH', agentPath(agent, `/${feature}`), { body: { enabled } }),
      );
    },
  };
}

export const routingAutofix = toggleCommand('autofix');
export const routingRecording = toggleCommand('recording');
