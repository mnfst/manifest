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
}

const KNOWN_CONTEXT_ERROR_CODES = new Set(['context_length_exceeded']);

const KNOWN_CONTEXT_ERROR_MESSAGE_PATTERNS = [
  /\b(?:this (?:model|endpoint)'s )?maximum context length is \d+ tokens\b/i,
  /\bmaximum context length exceeded\b/i,
];

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

function isHtmlErrorBody(rawBody: string): boolean {
  let offset = 0;
  while (offset < rawBody.length) {
    while (/\s/.test(rawBody.charAt(offset))) offset += 1;
    if (!rawBody.startsWith('<!--', offset)) break;

    const commentEnd = rawBody.indexOf('-->', offset + 4);
    if (commentEnd === -1) return false;
    offset = commentEnd + 3;
  }

  return /^(?:<!doctype\s+html|<html)\b/i.test(rawBody.slice(offset));
}

function htmlEndpointError(status: number | null | undefined, rawBody: string): string | null {
  if (!isHtmlErrorBody(rawBody)) return null;
  const ngrokCode = rawBody.match(/\bERR_NGROK_\d+\b/i)?.[0]?.toUpperCase();
  if (ngrokCode && /\bendpoint\b[\s\S]{0,300}\bis offline\b/i.test(rawBody)) {
    return `Tunnel endpoint is offline (${ngrokCode})`;
  }
  return status == null
    ? 'Upstream endpoint returned an HTML error page'
    : `Upstream endpoint returned HTTP ${status}`;
}

function extractProviderErrorCode(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const error = parsed.error as Record<string, unknown> | undefined;
    const code = error?.code ?? parsed.code;
    return typeof code === 'string' && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

function hasKnownContextErrorCode(rawBody: string): boolean {
  const code = extractProviderErrorCode(rawBody);
  if (code && KNOWN_CONTEXT_ERROR_CODES.has(code.toLowerCase())) return true;
  return /\bcontext_length_exceeded\b/i.test(rawBody);
}

function hasKnownContextErrorMessage(rawBody: string): boolean {
  const message = extractProviderMessage(rawBody) ?? rawBody;
  return KNOWN_CONTEXT_ERROR_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function isContextLengthError(status: number, rawBody: string): boolean {
  if (status < 400) return false;
  return hasKnownContextErrorCode(rawBody) || hasKnownContextErrorMessage(rawBody);
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
  };
}

export function sanitizeProviderError(status: number, rawBody: string, nodeEnv?: string): string {
  const generic = KNOWN_ERROR_MESSAGES[status] ?? `Upstream provider returned HTTP ${status}`;
  const endpointError = htmlEndpointError(status, rawBody);
  if (endpointError) return endpointError;
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

export function normalizeProviderErrorForStorage(
  status: number | null | undefined,
  rawBody: string,
): string {
  return htmlEndpointError(status, rawBody) ?? rawBody;
}
