import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthUser } from '../../auth/auth.instance';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import type { ProviderConnectionScope } from '../routing-core/provider.service';
import { optionalTrimmedStringQuery } from './query-params';

export async function resolveOAuthConnectionScope(
  resolveAgent: ResolveAgentService,
  user: AuthUser,
  agentName: string | string[] | undefined,
  scopeValue: string | string[] | undefined,
): Promise<ProviderConnectionScope> {
  const scope = optionalTrimmedStringQuery(scopeValue, 'scope');
  if (scope === 'global') {
    return { type: 'global', userId: user.id };
  }
  if (scope !== undefined) {
    throw new HttpException('scope query parameter must be "global"', HttpStatus.BAD_REQUEST);
  }

  const resolvedAgentName = optionalTrimmedStringQuery(agentName, 'agentName');
  if (!resolvedAgentName) {
    throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
  }

  const agent = await resolveAgent.resolve(user.id, resolvedAgentName);
  return { type: 'agent', agentId: agent.id, userId: user.id };
}
