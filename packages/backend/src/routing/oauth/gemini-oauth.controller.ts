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
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { GeminiOauthService } from './gemini-oauth.service';
import { OAuthTokenBlob, oauthDoneHtml } from './openai-oauth.types';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { ProviderService } from '../routing-core/provider.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';

/**
 * Mirrors {@link OpenaiOauthController} for the Google AI Pro / Ultra
 * subscription flow. The frontend opens the returned authorize URL in a
 * popup; the loopback callback server inside {@link GeminiOauthService}
 * exchanges the code, then redirects to `/api/v1/oauth/gemini/done` so
 * the popup can postMessage the result back to the dashboard.
 */
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
    // Prefer BETTER_AUTH_URL (operator-controlled) over the request Host header
    // so a forged Host can't redirect the popup to an attacker-controlled URL.
    const trustedBackendUrl = this.configService.get<string>('BETTER_AUTH_URL');
    const backendUrl = trustedBackendUrl || `${req.protocol}://${req.get('host')}`;
    try {
      const url = await this.oauthService.generateAuthorizationUrl(agent.id, user.id, backendUrl);
      return { url };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start OAuth callback server';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Revoke the stored Gemini OAuth token at Google (best-effort) and remove
   * the subscription provider record locally.
   */
  @Post('revoke')
  async revoke(@Query('agentName') agentName: string, @CurrentUser() user: AuthUser) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    const apiKey = await this.providerKeyService.getProviderApiKey(
      agent.id,
      'gemini',
      'subscription',
    );

    if (apiKey) {
      try {
        const blob = JSON.parse(apiKey) as OAuthTokenBlob;
        // Revoke both tokens — Google treats them as separate revocable
        // credentials so we explicitly hit each.
        if (blob.t) await this.oauthService.revokeToken(blob.t);
        if (blob.r) await this.oauthService.revokeToken(blob.r);
      } catch {
        this.logger.warn('Could not parse Gemini OAuth blob for revocation');
      }
    }

    await this.providerService.removeProvider(agent.id, 'gemini', 'subscription');
    return { ok: true };
  }

  /**
   * Manual callback used by cloud deployments where the loopback callback
   * server isn't reachable. The frontend extracts code+state from the
   * popup's failed redirect and POSTs them here.
   */
  @Post('callback')
  async callback(
    @Body('code') code: string,
    @Body('state') state: string,
    @CurrentUser() _user: AuthUser,
  ) {
    if (!code || !state) {
      throw new HttpException('code and state are required', HttpStatus.BAD_REQUEST);
    }
    try {
      await this.oauthService.exchangeCode(state, code);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      this.logger.error(`Gemini OAuth callback exchange failed: ${message}`);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Completion page. The loopback callback server redirects to this route on
   * the main backend's origin so postMessage / BroadcastChannel reach the
   * opener (same origin).
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
