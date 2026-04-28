import { ExceptionFilter, Catch, NotFoundException, ArgumentsHost } from '@nestjs/common';
import { Response, Request } from 'express';
import { join } from 'path';
import { readFileSync } from 'fs';
import { resolveFrontendDir } from '../utils/frontend-path';
import { rewriteOgTags } from '../utils/og-rewrite';

const NON_SPA_PREFIXES = ['/api/', '/otlp/', '/v1/', '/assets/'];

@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  private readonly indexContent: string | null;

  constructor(betterAuthUrl?: string) {
    const frontendDir = resolveFrontendDir();
    const raw = frontendDir ? readFileSync(join(frontendDir, 'index.html'), 'utf-8') : null;
    const baseUrl = betterAuthUrl ?? process.env['BETTER_AUTH_URL'] ?? '';
    this.indexContent = raw ? rewriteOgTags(raw, baseUrl) : null;
  }

  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (
      req.method !== 'GET' ||
      !this.indexContent ||
      NON_SPA_PREFIXES.some((p) => req.originalUrl.startsWith(p))
    ) {
      const response = exception.getResponse();
      const status = exception.getStatus();
      res.status(status).json(response);
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(this.indexContent);
  }
}
