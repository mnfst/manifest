import { Controller, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { KiroOauthService } from './kiro-oauth.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';

@Controller('api/v1/oauth/kiro')
export class KiroOauthController {
  constructor(
    private readonly oauthService: KiroOauthService,
    private readonly resolveAgent: ResolveAgentService,
  ) {}

  @Post('cli-connect')
  async connectFromCli(@Query('agentName') agentName: string, @CurrentUser() user: AuthUser) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    try {
      return await this.oauthService.connectFromCli(agent.id, user.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect Kiro CLI OAuth';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
