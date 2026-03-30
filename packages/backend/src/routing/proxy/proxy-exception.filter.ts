import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response as ExpressResponse } from 'express';
import { getDashboardUrl, sendFriendlyResponse } from './proxy-friendly-response';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';

/** Guard-thrown messages that should become friendly chat responses. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'Authorization header required':
    'Missing API key. Set your Manifest key (starts with mnfst_) as the Bearer token.',
  'Empty token':
    'Bearer token is empty — paste your Manifest API key into the authorization field.',
  'Invalid API key format':
    'That doesn\'t look like a Manifest key. They start with "mnfst_" — check your dashboard.',
  'API key expired': 'This API key expired. Generate a new one from your Manifest dashboard',
  'Invalid API key':
    "This API key wasn't recognized — it may have been rotated or deleted. Check your dashboard for the current key.",
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
    const ingestionCtx = (req as Request & { ingestionContext?: IngestionContext })
      .ingestionContext;
    const agentName = ingestionCtx?.agentName;

    const friendly = AUTH_ERROR_MESSAGES[message];
    if (friendly) {
      const dashboardUrl = getDashboardUrl(this.config, agentName);
      const content =
        message === 'API key expired'
          ? `${friendly}: ${dashboardUrl}`
          : `${friendly}\n\nDashboard: ${dashboardUrl}`;
      sendFriendlyResponse(res, content, isStream);
      return;
    }

    // Other errors (400 bad request, 500, etc.) — send as friendly chat message
    const content = status >= 500 ? 'Something broke on our end. Try again shortly.' : message;
    sendFriendlyResponse(res, content, isStream);
  }
}
