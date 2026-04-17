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

    const friendly = AUTH_ERROR_MESSAGES[message];
    if (friendly) {
      const dashboardUrl = getDashboardUrl(this.config);
      const content =
        message === 'API key expired'
          ? `${friendly}: ${dashboardUrl}`
          : `${friendly}\n\nDashboard: ${dashboardUrl}`;
      sendFriendlyResponse(res, content, isStream);
      return;
    }

    // Other errors (400 bad request, 500, etc.) — send as friendly chat message
    const content =
      status >= 500 ? '[🦚 Manifest] Something broke on our end. Try again in a moment.' : message;
    sendFriendlyResponse(res, content, isStream);
  }
}
