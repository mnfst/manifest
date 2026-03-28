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

export function sanitizeProviderError(status: number, rawBody: string, nodeEnv?: string): string {
  const generic = KNOWN_ERROR_MESSAGES[status] ?? `Upstream provider returned HTTP ${status}`;

  // In production, only return generic error messages to avoid leaking provider internals
  if (nodeEnv === 'production') return generic;

  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const error = parsed.error as Record<string, unknown> | undefined;
    const message = error?.message ?? parsed.message;
    if (typeof message === 'string' && message.length > 0) {
      return message.slice(0, 500);
    }
  } catch {
    // Not JSON — fall through to generic message
  }

  return generic;
}
