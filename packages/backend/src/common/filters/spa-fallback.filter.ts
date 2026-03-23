import { ExceptionFilter, Catch, NotFoundException, ArgumentsHost } from '@nestjs/common';
import { Response, Request } from 'express';
import { join } from 'path';
import { readFileSync } from 'fs';
import { resolveFrontendDir } from '../utils/frontend-path';

const API_PREFIXES = ['/api/', '/otlp/', '/v1/'];

@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  private readonly indexContent: string | null;

  constructor() {
    const frontendDir = resolveFrontendDir();
    this.indexContent = frontendDir ? readFileSync(join(frontendDir, 'index.html'), 'utf-8') : null;
  }

  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (
      req.method !== 'GET' ||
      !this.indexContent ||
      API_PREFIXES.some((p) => req.originalUrl.startsWith(p))
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
