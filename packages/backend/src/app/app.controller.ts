import { Controller, Get, Res, Req, Next } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { resolveFrontendDir } from '../common/utils/frontend-path';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SPA Fallback Controller
 *
 * Handles client-side routing by returning index.html for all unmatched routes.
 * This ensures that refreshing the browser on routes like /agents/local-agent
 * works correctly by letting the frontend router handle the routing.
 *
 * Note: Must be registered AFTER ServeStaticModule to act as fallback.
 */
@Controller()
export class AppController {
  private readonly indexPath: string | null;
  private readonly frontendDir: string | null;

  constructor() {
    this.frontendDir = resolveFrontendDir();
    this.indexPath = this.frontendDir ? path.join(this.frontendDir, 'index.html') : null;
  }

  @Public()
  @Get('agents/:agentName')
  @Get('agents/:agentName/:path')
  agentRoutes(@Req() req: Request, @Res() res: Response, @Next() next: () => void) {
    // If index.html doesn't exist, skip to next handler
    if (!this.indexPath || !fs.existsSync(this.indexPath)) {
      return next();
    }

    // Return index.html for agent routes (SPA client-side routing)
    res.sendFile(this.indexPath);
  }

  @Public()
  @Get('*')
  wildcardFallback(@Req() req: Request, @Res() res: Response, @Next() next: () => void) {
    // If index.html doesn't exist, skip to next handler
    if (!this.indexPath || !fs.existsSync(this.indexPath)) {
      return next();
    }

    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/otlp') || req.path.startsWith('/v1')) {
      return next();
    }

    // Skip static assets (files with extensions)
    if (path.extname(req.path) !== '') {
      return next();
    }

    // Check if the requested path exists as a file
    const filePath = path.join(this.frontendDir || '', req.path);
    if (this.frontendDir && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }

    // Return index.html for all other routes (SPA client-side routing)
    res.sendFile(this.indexPath);
  }
}
