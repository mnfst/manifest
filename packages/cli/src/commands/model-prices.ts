import { CliIo, clientFromFlags, printJson } from '../context';
import { parseArgs } from '../args';
import { PROVIDER_CATALOG } from '../provider-catalog.gen';
import { resolveProviderId } from './provider';

interface PriceRow {
  model_name?: unknown;
  provider?: unknown;
  input_price_per_million?: unknown;
  output_price_per_million?: unknown;
}

/**
 * The install-wide price list — every model Manifest knows a price for, not
 * one agent's routable set. Deliberately agent-free: pricing is a property of
 * the install, so answering "what does model X cost" must not require
 * creating a probe agent first (`mnfst models <agent>` is the per-agent
 * question).
 *
 * The endpoint labels rows with the provider's DISPLAY name ("OpenAI"), so
 * --provider takes catalog ids/aliases and matches either form.
 */
export async function modelPrices(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, { strings: ['url', 'provider'] });
  const providerId = args.strings['provider'] ? resolveProviderId(args.strings['provider']) : null;
  const accepted = new Set(
    providerId === null
      ? []
      : [
          providerId,
          ...PROVIDER_CATALOG.filter((p) => p.id === providerId).map((p) =>
            p.displayName.toLowerCase(),
          ),
        ],
  );

  const { client } = clientFromFlags(io, args);
  const result = (await client.request('GET', '/model-prices')) as {
    models?: unknown;
    lastSyncedAt?: unknown;
  } | null;

  const models = (Array.isArray(result?.models) ? result.models : [])
    .filter((row): row is PriceRow => typeof row === 'object' && row !== null)
    .filter((row) => providerId === null || accepted.has(String(row.provider ?? '').toLowerCase()))
    .map((row) => ({
      model: row.model_name,
      provider: row.provider,
      input_price_per_million: row.input_price_per_million,
      output_price_per_million: row.output_price_per_million,
    }));

  printJson(io, {
    ...(providerId !== null ? { provider: providerId } : {}),
    count: models.length,
    last_synced_at: result?.lastSyncedAt ?? null,
    models,
  });
}
