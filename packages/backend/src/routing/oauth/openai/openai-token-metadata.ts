const OPENAI_AUTH_CLAIM = 'https://api.openai.com/auth';
const MAX_ACCOUNT_ID_LENGTH = 256;

export interface OpenAiSubscriptionMetadata {
  accountId?: string;
  fedramp?: boolean;
}

/**
 * Read routing metadata from an OpenAI OAuth access token without trusting it
 * as authorization data. The token itself is already authenticated upstream;
 * these claims only reproduce the account headers the official Codex client
 * sends alongside that same bearer token.
 */
export function extractOpenAiSubscriptionMetadata(accessToken: string): OpenAiSubscriptionMetadata {
  const claims = decodeJwtPayload(accessToken);
  const auth = isRecord(claims?.[OPENAI_AUTH_CLAIM])
    ? claims[OPENAI_AUTH_CLAIM]
    : isRecord(claims)
      ? claims
      : null;
  if (!auth) return {};

  const accountId = safeHeaderValue(auth.chatgpt_account_id);
  const fedramp = auth.chatgpt_account_is_fedramp === true;
  return {
    ...(accountId ? { accountId } : {}),
    ...(fedramp ? { fedramp: true } : {}),
  };
}

export function serializeOpenAiSubscriptionMetadata(
  metadata: OpenAiSubscriptionMetadata,
): string | undefined {
  const accountId = safeHeaderValue(metadata.accountId);
  const fedramp = metadata.fedramp === true;
  if (!accountId && !fedramp) return undefined;
  return JSON.stringify({
    ...(accountId ? { a: accountId } : {}),
    ...(fedramp ? { f: true } : {}),
  });
}

export function parseOpenAiSubscriptionMetadata(
  serialized: string | undefined,
): OpenAiSubscriptionMetadata {
  if (!serialized || serialized.length > 1024) return {};
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!isRecord(parsed)) return {};
    const accountId = safeHeaderValue(parsed.a);
    return {
      ...(accountId ? { accountId } : {}),
      ...(parsed.f === true ? { fedramp: true } : {}),
    };
  } catch {
    return {};
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    return isRecord(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function safeHeaderValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!cleaned || cleaned.length > MAX_ACCOUNT_ID_LENGTH) return undefined;
  return cleaned;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
