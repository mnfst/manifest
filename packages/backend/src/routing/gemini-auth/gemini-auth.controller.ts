import { Controller, Get, Query, Req, Res, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { GeminiAuthService } from './gemini-auth.service';
import { RoutingService } from '../routing.service';
import { ResolveAgentService } from '../resolve-agent.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.instance';

@Controller('api/v1/routing/gemini-auth')
export class GeminiAuthController {
  private readonly logger = new Logger(GeminiAuthController.name);

  /** Pending OAuth states: state → { agentName, userId, expiresAt } */
  private readonly pendingStates = new Map<
    string,
    { agentName: string; userId: string; expiresAt: number }
  >();

  constructor(
    private readonly geminiAuth: GeminiAuthService,
    private readonly routingService: RoutingService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  private getCallbackUrl(req: Request): string {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${proto}://${host}/api/v1/routing/gemini-auth/callback`;
  }

  @Get()
  start(
    @Query('agent') agentName: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    if (!agentName) throw new BadRequestException('agent query parameter required');
    if (!this.geminiAuth.isConfigured()) {
      throw new BadRequestException('Google OAuth not configured (GOOGLE_CLIENT_ID missing)');
    }

    // Sweep expired states to prevent unbounded growth
    const now = Date.now();
    for (const [key, val] of this.pendingStates) {
      if (val.expiresAt < now) this.pendingStates.delete(key);
    }

    const state = this.geminiAuth.generateState();
    this.pendingStates.set(state, {
      agentName,
      userId: user.id,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
    });

    const callbackUrl = this.getCallbackUrl(req);
    const authUrl = this.geminiAuth.buildAuthUrl(callbackUrl, state);

    this.logger.log(`Starting Gemini OAuth for agent=${agentName} user=${user.id}`);
    res.redirect(authUrl);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      res.status(400).send(this.closePage('Missing code or state parameter.'));
      return;
    }

    const pending = this.pendingStates.get(state);
    this.pendingStates.delete(state);

    if (!pending || pending.expiresAt < Date.now()) {
      res.status(400).send(this.closePage('OAuth state expired or invalid. Try again.'));
      return;
    }

    try {
      const callbackUrl = this.getCallbackUrl(req);
      const refreshToken = await this.geminiAuth.exchangeCode(code, callbackUrl);

      const agent = await this.resolveAgentService.resolve(pending.userId, pending.agentName);
      await this.routingService.upsertProvider(
        agent.id,
        pending.userId,
        'gemini',
        refreshToken,
        'subscription',
      );

      this.logger.log(
        `Gemini OAuth completed for agent=${pending.agentName} user=${pending.userId}`,
      );
      res.send(this.closePage('Gemini connected successfully! You can close this window.', true));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gemini OAuth callback error: ${msg}`);
      res.status(500).send(this.closePage('Failed to complete Google authentication. Try again.'));
    }
  }

  private closePage(message: string, success = false): string {
    const color = success ? '#16a34a' : '#dc2626';
    return `<!DOCTYPE html><html><head><title>Manifest</title></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:system-ui;background:#fafaf9">
<div style="text-align:center;max-width:400px">
<p style="color:${color};font-size:16px">${message}</p>
<script>window.opener?.postMessage({type:'gemini-auth-done',success:${success}},window.location.origin);setTimeout(()=>window.close(),2000)</script>
</div></body></html>`;
  }
}
