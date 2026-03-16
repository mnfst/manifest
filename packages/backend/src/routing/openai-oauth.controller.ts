import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { OpenaiOauthService, OAuthTokenBlob, oauthDoneHtml } from './openai-oauth.service';
import { ResolveAgentService } from './resolve-agent.service';
import { RoutingService } from './routing.service';

@Controller('api/v1/oauth/openai')
export class OpenaiOauthController {
  private readonly logger = new Logger(OpenaiOauthController.name);

  constructor(
    private readonly oauthService: OpenaiOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly routingService: RoutingService,
  ) {}

  /**
   * Generates an OpenAI OAuth authorize URL with PKCE challenge.
   * The frontend opens this URL in a popup window.
   * A temporary callback server on port 1455 handles the redirect.
   */
  @Get('authorize')
  async authorize(
    @Query('agentName') agentName: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    const backendUrl = `${req.protocol}://${req.get('host')}`;
    try {
      const url = await this.oauthService.generateAuthorizationUrl(agent.id, user.id, backendUrl);
      return { url };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start OAuth callback server';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Revoke the stored OpenAI OAuth token (best-effort) and disconnect the provider.
   */
  @Post('revoke')
  async revoke(@Query('agentName') agentName: string, @CurrentUser() user: AuthUser) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    const apiKey = await this.routingService.getProviderApiKey(agent.id, 'openai', 'subscription');

    if (apiKey) {
      try {
        const blob = JSON.parse(apiKey) as OAuthTokenBlob;
        if (blob.t) await this.oauthService.revokeToken(blob.t);
        if (blob.r) await this.oauthService.revokeToken(blob.r);
      } catch {
        this.logger.warn('Could not parse OAuth token blob for revocation');
      }
    }

    await this.routingService.removeProvider(agent.id, 'openai', 'subscription');

    return { ok: true };
  }

  /**
   * OAuth callback endpoint for production deployments.
   * OpenAI redirects here with ?code=...&state=... after user authorizes.
   * Exchanges the code for tokens, then serves the done page.
   */
  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDesc: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'");

    if (error) {
      this.logger.error(`OAuth callback error: ${errorDesc || error}`);
      if (state) this.oauthService.clearPendingState(state);
      res.send(oauthDoneHtml(false));
      return;
    }

    try {
      await this.oauthService.exchangeCode(state, code);
      res.send(oauthDoneHtml(true));
    } catch (err) {
      this.logger.error(`OAuth callback exchange failed: ${err}`);
      res.send(oauthDoneHtml(false));
    }
  }

  /**
   * Completion page served on the main backend's origin.
   * The port-1455 callback server redirects here after token exchange
   * so that postMessage reaches the opener (same origin).
   */
  @Get('done')
  @Public()
  done(@Query('ok') ok: string, @Res() res: Response) {
    const success = ok === '1';

    res.setHeader('Content-Type', 'text/html');
    // Override Helmet's CSP to allow the inline script on this page
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'");
    res.send(oauthDoneHtml(success));
  }
}
