import { Logger } from '@nestjs/common';
import { DiscoveredModel } from './model-fetcher';

const logger = new Logger('AnthropicSubscriptionProbe');

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const PROBE_TIMEOUT_MS = 5000;

/** Extract the model family from an Anthropic model ID (e.g. "claude-sonnet-4-6" → "sonnet"). */
const FAMILY_RE = /^claude-(?:\d+(?:-\d+)*-)?([a-z]+)/i;

export function extractFamily(modelId: string): string | null {
  const match = FAMILY_RE.exec(modelId);
  return match?.[1] ?? null;
}

/**
 * Probe a single model with a minimal request to check subscription access.
 * Returns true if the model is accessible, false if Anthropic rejects it.
 */
async function probeModel(apiKey: string, modelId: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1,
        system: [
          {
            type: 'text',
            text: "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: '.' }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) return true;

    // Only treat genuine permission/tier errors as inaccessible.
    // invalid_request_error means our probe format is wrong, not that
    // the subscription can't access this model.
    if (res.status === 400 || res.status === 403) {
      try {
        const body = (await res.json()) as Record<string, unknown>;
        const error = body.error as Record<string, unknown> | undefined;
        const errorType = error?.type as string | undefined;

        // These error types indicate the subscription genuinely cannot
        // access this model family:
        if (
          errorType === 'authentication_error' ||
          errorType === 'permission_error' ||
          errorType === 'not_found_error'
        ) {
          return false;
        }

        // invalid_request_error = our probe request is malformed,
        // NOT a tier restriction. Keep the model.
        logger.debug(
          `Probe for ${modelId} got ${res.status}/${errorType} — treating as accessible (not a tier error)`,
        );
        return true;
      } catch {
        // Can't parse error body — inconclusive, keep the model
        return true;
      }
    }

    // Other errors (429 rate limit, 500 server error) — don't exclude the model,
    // it might work later. Only subscription tier rejections are deterministic.
    return true;
  } catch {
    // Network/timeout error — keep the model (don't penalize for transient failures)
    return true;
  }
}

/**
 * Filter Anthropic subscription models by probing one model per family.
 *
 * Groups models by family (haiku, sonnet, opus), probes one representative
 * from each family, and removes all models from families the subscription
 * cannot access. Only called for Anthropic subscription auth — API key
 * providers are never probed.
 */
export async function filterBySubscriptionAccess(
  models: DiscoveredModel[],
  apiKey: string,
): Promise<DiscoveredModel[]> {
  // Group models by family
  const familyMap = new Map<string, DiscoveredModel[]>();
  const noFamily: DiscoveredModel[] = [];

  for (const model of models) {
    const family = extractFamily(model.id);
    if (!family) {
      noFamily.push(model);
      continue;
    }
    const group = familyMap.get(family) ?? [];
    group.push(model);
    familyMap.set(family, group);
  }

  // Probe one model per family in parallel
  const families = [...familyMap.keys()];
  const probeResults = await Promise.all(
    families.map(async (family) => {
      const representative = familyMap.get(family)![0];
      const accessible = await probeModel(apiKey, representative.id);
      if (!accessible) {
        logger.log(
          `Anthropic subscription: ${family} models not accessible (probed ${representative.id})`,
        );
      }
      return { family, accessible };
    }),
  );

  const accessibleFamilies = new Set(probeResults.filter((r) => r.accessible).map((r) => r.family));
  const blockedFamilies = families.filter((f) => !accessibleFamilies.has(f));

  if (blockedFamilies.length > 0) {
    logger.log(
      `Anthropic subscription: accessible families=[${[...accessibleFamilies].join(', ')}], ` +
        `blocked families=[${blockedFamilies.join(', ')}]`,
    );
  }

  const filtered = models.filter((model) => {
    const family = extractFamily(model.id);
    if (!family) return true;
    return accessibleFamilies.has(family);
  });

  return filtered;
}
