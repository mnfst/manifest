import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SPA Fallback Middleware
 *
 * Intercepts requests for non-API routes and returns index.html.
 * This enables client-side routing (refreshing /agents/local-agent works).
 *
 * Must be configured in AppModule to apply to all routes.
 */
@Injectable()
export class SpaFallbackMiddleware implements NestMiddleware {
  private readonly indexPath: string;
  private readonly frontendDir: string;

  constructor() {
    // In the plugin context, frontend is in public/
    const moduleDir = path.dirname(__filename);
    const distDir = path.join(moduleDir, '..', '..', '..', '..', 'dist');
    this.frontendDir = path.join(distDir, 'public');
    this.indexPath = path.join(this.frontendDir, 'index.html');
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/otlp') || req.path.startsWith('/v1')) {
      return next();
    }

    // Skip static assets (files with extensions)
    if (path.extname(req.path) !== '') {
      return next();
    }

    // If index.html doesn't exist, let it 404 normally
    if (!fs.existsSync(this.indexPath)) {
      return next();
    }

    // For all other routes, serve index.html (SPA routing)
    res.sendFile(this.indexPath);
  }
}
