import {
  Body,
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
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { TenantCtx, TenantContext } from '../../../common/decorators/tenant-context.decorator';
import { OAuthTokenBlob, oauthDoneHtml } from '../core';
import { GeminiOauthService } from './gemini-oauth.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';
import { ProviderKeyService } from '../../routing-core/provider-key.service';
import { optionalTrimmedStringQuery } from '../core/query-params';

@Controller('api/v1/oauth/gemini')
export class GeminiOauthController {
  private readonly logger = new Logger(GeminiOauthController.name);

  constructor(
    private readonly oauthService: GeminiOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a Google OAuth authorize URL with PKCE challenge. The frontend
   * opens this URL in a popup; a temporary callback server on port 1455
   * handles the redirect (dev) or the popup falls through to the manual
   * `/callback` POST (prod).
   */
  @Get('authorize')
  async authorize(
    @Query('agentName') agentName: string,
    @TenantCtx() ctx: TenantContext,
    @Req() req: Request,
  ) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const agent = await this.resolveAgent.resolve(ctx.tenantId, agentName);
    // Prefer the operator-configured BETTER_AUTH_URL so a forged Host header
    // cannot redirect the OAuth flow.
    const trustedBackendUrl = this.configService.get<string>('BETTER_AUTH_URL');
    const backendUrl = trustedBackendUrl || `${req.protocol}://${req.get('host')}`;
    try {
      const url = await this.oauthService.generateAuthorizationUrl(
        agent.id,
        agent.tenant_id,
        backendUrl,
        ctx.userId,
      );
      return { url };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start OAuth callback server';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Revoke the stored Gemini OAuth token (best-effort) and disconnect the
   * provider. Mirrors the OpenAI flow.
   */
  @Post('revoke')
  async revoke(
    @Query('agentName') agentName: string,
    @Query('label') label: string | string[] | undefined,
    @TenantCtx() ctx: TenantContext,
  ) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const keyLabel = optionalTrimmedStringQuery(label, 'label');
    const agent = await this.resolveAgent.resolve(ctx.tenantId, agentName);
    const keys = await this.providerKeyService.getProviderKeys(
      agent.tenant_id,
      'gemini',
      'subscription',
    );
    const keysToRevoke = keyLabel
      ? keys.filter((key) => key.label.toLowerCase() === keyLabel.toLowerCase())
      : keys;

    for (const key of keysToRevoke) {
      if (!key.apiKey) continue;
      try {
        const blob = JSON.parse(key.apiKey) as OAuthTokenBlob;
        if (blob.t) await this.oauthService.revokeToken(blob.t);
        if (blob.r) await this.oauthService.revokeToken(blob.r);
      } catch {
        this.logger.warn('Could not parse OAuth token blob for revocation');
      }
    }

    const { notifications } = await this.providerService.removeProvider(
      agent.id,
      agent.tenant_id,
      'gemini',
      'subscription',
      keyLabel,
    );

    return { ok: true, notifications };
  }

  /**
   * Manual OAuth callback for cloud deployments where the popup cannot reach
   * the local callback server. Frontend extracts code+state from the popup
   * URL and POSTs here.
   */
  @Post('callback')
  async callback(
    @Body('code') code: string,
    @Body('state') state: string,
    @TenantCtx() _ctx: TenantContext,
  ) {
    if (!code || !state) {
      throw new HttpException('code and state are required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.oauthService.exchangeCode(state, code);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      this.logger.error(`OAuth callback exchange failed: ${message}`);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Completion page served on the main backend's origin. The port-1455
   * callback server redirects here after token exchange so a `postMessage`
   * reaches the popup opener (same origin).
   */
  @Get('done')
  @Public()
  done(@Query('ok') ok: string, @Res() res: Response) {
    const success = ok === '1';
    const nonce = randomBytes(16).toString('base64');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'`);
    res.send(oauthDoneHtml(success, nonce));
  }
}
