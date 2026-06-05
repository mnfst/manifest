import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../auth/current-user.decorator';
import { AuthUser } from '../../../auth/auth.instance';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';
import { AnthropicOauthExchangeError, AnthropicOauthService } from './anthropic-oauth.service';
import { optionalTrimmedStringQuery } from '../query-params';
import { resolveOAuthConnectionScope } from '../oauth-scope';

@Controller('api/v1/oauth/anthropic')
export class AnthropicOauthController {
  private readonly logger = new Logger(AnthropicOauthController.name);

  constructor(
    private readonly oauthService: AnthropicOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Generate the Anthropic OAuth authorize URL with PKCE. The frontend opens
   * the returned URL in a new tab; Anthropic's redirect page then displays
   * the authorization code for the user to paste into the SPA.
   */
  @Post('authorize')
  async authorize(
    @Query('agentName') agentName: string | string[] | undefined,
    @CurrentUser() user: AuthUser,
    @Query('scope') scopeValue?: string | string[],
  ) {
    const scope = await resolveOAuthConnectionScope(this.resolveAgent, user, agentName, scopeValue);
    return this.oauthService.generateAuthorizationUrl(
      scope.type === 'agent' ? scope.agentId : scope,
      user.id,
    );
  }

  /**
   * Exchange the pasted authorization payload (`<code>#<state>` or just the
   * code with state in the body) for an OAuth token blob.
   */
  @Post('exchange')
  async exchange(
    @Query('agentName') agentName: string | string[] | undefined,
    @Body('code') code: string,
    @Body('state') state: string,
    @CurrentUser() user: AuthUser,
    @Query('scope') scopeValue?: string | string[],
  ) {
    if (!code) {
      throw new HttpException('code is required', HttpStatus.BAD_REQUEST);
    }
    const scope = await resolveOAuthConnectionScope(this.resolveAgent, user, agentName, scopeValue);
    try {
      await this.oauthService.exchangeCode(
        code,
        state,
        scope.type === 'agent' ? scope.agentId : scope,
        user.id,
      );
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      this.logger.error(`Anthropic OAuth exchange failed: ${message}`);
      throw new HttpException(
        message,
        err instanceof AnthropicOauthExchangeError ? err.status : HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Hydrates the SPA after a tab/modal close: returns the active pending
   * state for an agent if a sign-in flow was started but not yet exchanged,
   * so the paste-code field can be re-rendered without restarting the dance.
   */
  @Get('pending')
  async pending(
    @Query('agentName') agentName: string | string[] | undefined,
    @CurrentUser() user: AuthUser,
    @Query('scope') scopeValue?: string | string[],
  ) {
    const scope = await resolveOAuthConnectionScope(this.resolveAgent, user, agentName, scopeValue);
    const pending =
      scope.type === 'agent'
        ? await this.oauthService.findPendingForAgent(scope.agentId, user.id)
        : await this.oauthService.findPendingForConnection(scope, user.id);
    return pending ?? { state: null };
  }

  /** Disconnect the Anthropic subscription provider for an agent. */
  @Post('revoke')
  async revoke(
    @Query('agentName') agentName: string | string[] | undefined,
    @Query('label') label: string | string[] | undefined,
    @CurrentUser() user: AuthUser,
    @Query('scope') scopeValue?: string | string[],
  ) {
    const keyLabel = optionalTrimmedStringQuery(label, 'label');
    const scope = await resolveOAuthConnectionScope(this.resolveAgent, user, agentName, scopeValue);
    const { notifications } =
      scope.type === 'agent'
        ? await this.providerService.removeProvider(
            scope.agentId,
            'anthropic',
            'subscription',
            keyLabel,
          )
        : await this.providerService.removeProviderForConnection(
            scope,
            'anthropic',
            'subscription',
            keyLabel,
          );
    return { ok: true, notifications };
  }
}
