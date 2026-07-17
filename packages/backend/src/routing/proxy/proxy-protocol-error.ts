import type { Request, Response as ExpressResponse } from 'express';

import type { ProxyApiMode } from './proxy-types';

const ANTHROPIC_ERROR_TYPE_BY_STATUS: Record<number, string> = {
  400: 'invalid_request_error',
  401: 'authentication_error',
  402: 'permission_error',
  403: 'permission_error',
  404: 'not_found_error',
  413: 'request_too_large',
  429: 'rate_limit_error',
  529: 'overloaded_error',
};

export function anthropicErrorTypeForStatus(status: number | undefined): string {
  return (status && ANTHROPIC_ERROR_TYPE_BY_STATUS[status]) || 'api_error';
}

export function proxyApiModeFromRequest(req: Request): ProxyApiMode {
  const rawPath = req.path || req.originalUrl || req.url || '';
  const path = rawPath.split('?')[0].replace(/\/+$/, '');
  if (path.endsWith('/v1/messages')) return 'messages';
  if (path.endsWith('/v1/responses')) return 'responses';
  return 'chat_completions';
}

export function isCodingClientApiMode(apiMode: ProxyApiMode): boolean {
  return apiMode === 'messages' || apiMode === 'responses';
}

export function sendProxyProtocolError(
  res: ExpressResponse,
  apiMode: ProxyApiMode,
  status: number,
  message: string,
  options: { code?: string; openAiType?: string } = {},
): void {
  res.status(status);
  if (apiMode === 'messages') {
    res.json({
      type: 'error',
      error: {
        type: anthropicErrorTypeForStatus(status),
        message,
      },
    });
    return;
  }

  const type =
    options.openAiType ??
    (status === 401
      ? 'authentication_error'
      : status === 402
        ? 'insufficient_quota'
        : status === 429
          ? 'rate_limit_error'
          : status >= 500
            ? 'server_error'
            : 'invalid_request_error');
  res.json({
    error: {
      message,
      type,
      ...(options.code ? { code: options.code } : {}),
    },
  });
}
