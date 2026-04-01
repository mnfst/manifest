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
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { GeminiOauthService } from './gemini-oauth.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { ProviderService } from '../routing-core/provider.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { OAuthTokenBlob, oauthDoneHtml } from './openai-oauth.types';

@Controller('api/v1/oauth/gemini')
export class GeminiOauthController {
  private readonly logger = new Logger(GeminiOauthController.name);

  constructor(
    private readonly oauthService: GeminiOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly providerService: ProviderService,
  ) {}

  private getCallbackUrl(req: Request): string {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${proto}://${host}/api/v1/oauth/gemini/callback`;
  }

  @Get('authorize')
  async authorize(
    @Query('agentName') agentName: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (!this.oauthService.isConfigured()) {
      throw new HttpException(
        'Google OAuth not configured (GOOGLE_CLIENT_ID or GOOGLE_GEMINI_CLIENT_ID missing)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    const callbackUrl = this.getCallbackUrl(req);
    const url = await this.oauthService.generateAuthorizationUrl(agent.id, user.id, callbackUrl);
    return { url };
  }

  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const backendUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;

    if (error) {
      this.logger.error(`Google OAuth callback error: ${error}`);
      res.redirect(`${backendUrl}/api/v1/oauth/gemini/done?ok=0`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${backendUrl}/api/v1/oauth/gemini/done?ok=0`);
      return;
    }

    try {
      await this.oauthService.exchangeCode(state, code);
      res.redirect(`${backendUrl}/api/v1/oauth/gemini/done?ok=1`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gemini OAuth callback failed: ${message}`);
      res.redirect(`${backendUrl}/api/v1/oauth/gemini/done?ok=0`);
    }
  }

  @Get('done')
  @Public()
  done(@Query('ok') ok: string, @Res() res: Response) {
    const success = ok === '1';
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'");
    res.send(oauthDoneHtml(success));
  }

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
        if (blob.t) await this.oauthService.revokeToken(blob.t);
        if (blob.r) await this.oauthService.revokeToken(blob.r);
      } catch {
        this.logger.warn('Could not parse Gemini OAuth token blob for revocation');
      }
    }

    await this.providerService.removeProvider(agent.id, 'gemini', 'subscription');

    return { ok: true };
  }
}
