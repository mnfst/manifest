const KNOWN_ERROR_MESSAGES: Record<number, string> = {
  400: 'Bad request to upstream provider',
  401: 'Authentication failed with upstream provider',
  403: 'Forbidden by upstream provider',
  404: 'Model or endpoint not found',
  408: 'Upstream provider request timed out',
  422: 'Upstream provider rejected the request',
  429: 'Rate limited by upstream provider',
  500: 'Upstream provider internal error',
  502: 'Upstream provider returned bad gateway',
  503: 'Upstream provider temporarily unavailable',
  504: 'Upstream provider gateway timeout',
};

export type OpenAiCompatibleErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'permission_error'
  | 'rate_limit_error'
  | 'server_error';

export interface ClassifiedProviderError {
  message: string;
  type: OpenAiCompatibleErrorType;
  code: 'context_length_exceeded';
  source: 'provider';
  terminal: true;
}

function sanitizeSensitivePatterns(msg: string): string {
  return msg
    .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, 'sk-ant-***')
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, 'sk-***')
    .replace(/key=[^&\s"]+/g, 'key=***')
    .replace(/Bearer\s+[^\s"]+/gi, 'Bearer ***');
}

function normalizeErrorMessage(message: string): string {
  return sanitizeSensitivePatterns(message).replace(/\s+/g, ' ').trim().slice(0, 1000);
}

function extractProviderMessage(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const error = parsed.error as Record<string, unknown> | undefined;
    const message = error?.message ?? parsed.message;
    return typeof message === 'string' && message.length > 0 ? message : null;
  } catch {
    return null;
  }
}

function providerErrorSearchText(rawBody: string): string {
  const message = extractProviderMessage(rawBody);
  return `${message ?? ''}\n${rawBody}`;
}

function isContextLengthError(status: number, rawBody: string): boolean {
  if (status < 400) return false;
  const text = providerErrorSearchText(rawBody).toLowerCase();
  return (
    text.includes('context_length_exceeded') ||
    text.includes('maximum context length') ||
    /\bcontext (?:length|window)\b.{0,80}\b(?:exceed|exceeded|limit|maximum|too long|too large)\b/.test(
      text,
    ) ||
    /\b(?:prompt|input)\b.{0,40}\btoo long\b/.test(text)
  );
}

export function openAiErrorTypeForStatus(status: number): OpenAiCompatibleErrorType {
  if (status === 401) return 'authentication_error';
  if (status === 403) return 'permission_error';
  if (status === 429) return 'rate_limit_error';
  if (status >= 500) return 'server_error';
  return 'invalid_request_error';
}

export function classifyProviderError(
  status: number,
  rawBody: string,
): ClassifiedProviderError | null {
  if (!isContextLengthError(status, rawBody)) return null;
  const message = extractProviderMessage(rawBody) ?? rawBody;
  return {
    message: normalizeErrorMessage(message),
    type: 'invalid_request_error',
    code: 'context_length_exceeded',
    source: 'provider',
    terminal: true,
  };
}

export function sanitizeProviderError(status: number, rawBody: string, nodeEnv?: string): string {
  const generic = KNOWN_ERROR_MESSAGES[status] ?? `Upstream provider returned HTTP ${status}`;
  const classified = classifyProviderError(status, rawBody);
  if (classified) return classified.message;

  // In production, only return generic error messages to avoid leaking provider internals
  if ((nodeEnv ?? 'production') === 'production') return generic;

  const message = extractProviderMessage(rawBody);
  if (message) {
    return normalizeErrorMessage(message).slice(0, 500);
  }

  return generic;
}
