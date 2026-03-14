import { ExceptionFilter, Catch, NotFoundException, ArgumentsHost } from '@nestjs/common';
import { Response, Request } from 'express';
import { join } from 'path';
import { resolveFrontendDir } from '../utils/frontend-path';

const API_PREFIXES = ['/api/', '/otlp/', '/v1/'];

@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  private readonly indexPath: string | null;

  constructor() {
    const frontendDir = resolveFrontendDir();
    this.indexPath = frontendDir ? join(frontendDir, 'index.html') : null;
  }

  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (
      req.method !== 'GET' ||
      !this.indexPath ||
      API_PREFIXES.some((p) => req.originalUrl.startsWith(p))
    ) {
      const response = exception.getResponse();
      const status = exception.getStatus();
      res.status(status).json(response);
      return;
    }

    res.sendFile(this.indexPath);
  }
}
