import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response as ExpressResponse } from 'express';
import { getDashboardUrl, sendFriendlyResponse } from './proxy-friendly-response';

/** Guard-thrown messages that should become friendly chat responses. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'Authorization header required':
    '[🦚 Manifest] Missing the Authorization header. Set it to "Bearer mnfst_<your-key>".',
  'Empty token': '[🦚 Manifest] The Bearer token is empty. Paste your Manifest key into it.',
  'Invalid API key format':
    '[🦚 Manifest] That doesn\'t look right. Manifest keys start with "mnfst_". Grab yours from the dashboard.',
  'API key expired': '[🦚 Manifest] This key has expired. Generate a new one here',
  'Invalid API key':
    "[🦚 Manifest] I don't recognize this key. It might have been rotated or deleted. Grab the current one from the dashboard.",
};

/** Status codes that should pass through as normal HTTP errors. */
const PASSTHROUGH_STATUSES = new Set([429]);

/**
 * Decide whether the caller is a chat-rendering client (streaming SDK or chat
 * UI) versus a tool/monitor/CI pipeline. Chat clients render the assistant
 * message verbatim, so we wrap errors in a friendly HTTP-200 envelope. Tools
 * inspect status codes, so they get real 4xx/5xx responses.
 *
 * Heuristics, in order:
 *   1. `body.stream === true` → SSE chat client.
 *   2. `Accept: text/event-stream` → SSE chat client even if stream flag missing.
 *   3. Anything else (curl, monitors, non-streaming SDKs) → real status code.
 *
 * The `Accept: application/json` case explicitly falls through to step 3 so
 * non-streaming SDK callers see the actual error and can surface it to user
 * code instead of accepting a stub response as success.
 */
export function isChatRenderingClient(req: Request): boolean {
  const body = req.body as Record<string, unknown> | undefined;
  if (body && body['stream'] === true) return true;
  const accept = req.headers['accept'];
  if (typeof accept === 'string' && accept.includes('text/event-stream')) return true;
  return false;
}

@Injectable()
@Catch(HttpException)
export class ProxyExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<ExpressResponse>();

    const status = exception.getStatus();
    const message = exception.message;

    // Rate limit errors should stay as HTTP 429 so clients can backoff
    if (PASSTHROUGH_STATUSES.has(status)) {
      const response = exception.getResponse();
      res
        .status(status)
        .json(
          typeof response === 'string'
            ? { error: { message: response, type: 'proxy_error' } }
            : response,
        );
      return;
    }

    const isStream = (req.body as Record<string, unknown>)?.stream === true;
    const isChatClient = isChatRenderingClient(req);

    const friendly = AUTH_ERROR_MESSAGES[message];
    if (friendly) {
      const dashboardUrl = getDashboardUrl(this.config);
      const content =
        message === 'API key expired'
          ? `${friendly}: ${dashboardUrl}`
          : `${friendly}\n\nDashboard: ${dashboardUrl}`;
      if (isChatClient) {
        sendFriendlyResponse(res, content, isStream);
      } else {
        // Real status — auth errors get 401, validation errors keep their status.
        const realStatus = status === 400 ? 400 : 401;
        res.status(realStatus).json({
          error: { message: content, type: 'auth_error', code: 'manifest_auth' },
        });
      }
      return;
    }

    if (isChatClient) {
      const content =
        status >= 500
          ? '[🦚 Manifest] Something broke on our end. Try again in a moment.'
          : message;
      sendFriendlyResponse(res, content, isStream);
      return;
    }

    // Tools and monitors: pass the real HTTP status with a structured envelope.
    const errorMessage =
      status >= 500 ? 'Manifest encountered an internal error. Try again shortly.' : message;
    res.status(status).json({
      error: {
        message: errorMessage,
        type: status >= 500 ? 'server_error' : 'invalid_request_error',
      },
    });
  }
}
