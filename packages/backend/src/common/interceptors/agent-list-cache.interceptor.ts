import { ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { UserCacheInterceptor } from './user-cache.interceptor';
import { agentListCacheKey } from '../constants/cache.constants';

/**
 * Cache interceptor for GET /agents. Unlike the generic URL-keyed
 * UserCacheInterceptor, it collapses every query-string variant (no param,
 * ?includeSystem=true, ?includeSystem=false, anything else) onto one of two
 * canonical keys based on the normalized `includeSystem` boolean. That keeps the
 * cached key set bounded to exactly two entries per user, so mutation handlers
 * can invalidate it exhaustively (see agentListCacheKey) without a stray URL
 * variant being left stale.
 */
@Injectable()
export class AgentListCacheInterceptor extends UserCacheInterceptor {
  protected trackBy(context: ExecutionContext): string | undefined {
    const userId = this.resolveUserId(context);
    if (!userId) return undefined;

    const request = context.switchToHttp().getRequest<Request>();
    const includeSystem =
      (request.query as { includeSystem?: string } | undefined)?.includeSystem === 'true';
    return agentListCacheKey(userId, includeSystem);
  }
}
