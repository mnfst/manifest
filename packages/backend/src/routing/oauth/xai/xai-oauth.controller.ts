import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { TenantCtx, TenantContext } from '../../../common/decorators/tenant-context.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderKeyService } from '../../routing-core/provider-key.service';
import { ProviderService } from '../../routing-core/provider.service';
import { oauthDoneHtml, type OAuthTokenBlob } from '../core';
import { optionalTrimmedStringQuery } from '../core/query-params';
import { XaiOauthService } from './xai-oauth.service';

@Controller('api/v1/oauth/xai')
export class XaiOauthController {
  private readonly logger = new Logger(XaiOauthController.name);

  constructor(
    private readonly oauthService: XaiOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
  ) {}

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
      this.logger.error(`xAI OAuth callback exchange failed: ${message}`);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

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
      'xai',
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
        this.logger.warn('Could not parse xAI OAuth token blob for revocation');
      }
    }

    const { notifications } = await this.providerService.removeProvider(
      agent.id,
      agent.tenant_id,
      'xai',
      'subscription',
      keyLabel,
    );

    return { ok: true, notifications };
  }

  @Get('done')
  @Public()
  done(@Query('ok') ok: string, @Res() res: Response) {
    const success = ok === '1';

    const nonce = randomBytes(16).toString('base64');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'`);
    res.send(oauthDoneHtml(success, nonce, 'xAI Login'));
  }
}
