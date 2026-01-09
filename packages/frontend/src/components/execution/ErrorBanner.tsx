/**
 * ErrorBanner - Displays error information prominently.
 *
 * Shows error message with optional HTTP status and URL context.
 * Used in NodeExecutionCard to make errors visible without expanding data.
 */

import { AlertTriangle, Globe } from 'lucide-react';

interface ErrorBannerProps {
  error: string;
  httpStatus?: number;
  requestUrl?: string;
}

/**
 * Get a human-readable description for common HTTP status codes.
 */
function getHttpStatusDescription(status: number): string {
  const descriptions: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return descriptions[status] || '';
}

export function ErrorBanner({ error, httpStatus, requestUrl }: ErrorBannerProps) {
  const httpStatusDescription = httpStatus ? getHttpStatusDescription(httpStatus) : '';

  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-700">Error</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>

          {/* HTTP Status Context */}
          {httpStatus && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
              <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded">
                HTTP {httpStatus}
              </span>
              {httpStatusDescription && (
                <span className="text-red-400">{httpStatusDescription}</span>
              )}
            </div>
          )}

          {/* Request URL Context */}
          {requestUrl && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
              <Globe className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono truncate" title={requestUrl}>
                {requestUrl}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
