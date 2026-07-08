import { scrubSecrets } from '../../common/utils/secret-scrub';
import type { PhoenixProviderError } from './phoenix.types';

const MAX_MESSAGE_LENGTH = 2000;

function coerceString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Like {@link coerceString} but scrubs secrets from the result. Every string
 * lifted off the upstream error body (`type`/`param`/`code`, not just `message`)
 * is shipped to Phoenix, so a provider that echoes a key in any of them must not
 * leak it.
 */
function coerceScrubbed(value: unknown): string | null {
  const raw = coerceString(value);
  return raw === null ? null : scrubSecrets(raw);
}

/**
 * Turn a raw upstream error body (the text of a 4xx provider response) into the
 * normalised `{ message, type, param, code }` shape Phoenix fingerprints on.
 *
 * Handles the OpenAI-compatible envelope (`{ error: { message, type, param,
 * code } }`), a flat `{ message, ... }` body, and non-JSON bodies (the raw text
 * becomes the message). Secrets are scrubbed and the message is length-capped so
 * we never ship a key or an unbounded blob to the healing service.
 */
export function normalizeProviderError(rawBody: string): PhoenixProviderError {
  let parsed: Record<string, unknown> | null = null;
  try {
    const json = JSON.parse(rawBody) as unknown;
    if (json && typeof json === 'object') parsed = json as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  const errorObj =
    parsed && typeof parsed.error === 'object' && parsed.error !== null
      ? (parsed.error as Record<string, unknown>)
      : parsed;

  const rawMessage = coerceString(errorObj?.message) ?? coerceString(parsed?.message) ?? rawBody;
  const message = scrubSecrets(rawMessage).slice(0, MAX_MESSAGE_LENGTH);

  return {
    message,
    type: coerceScrubbed(errorObj?.type),
    param: coerceScrubbed(errorObj?.param),
    code: coerceScrubbed(errorObj?.code),
  };
}
