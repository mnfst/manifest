import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ADMIN_KEY_SCOPE } from '../../common/constants/admin-key.constants';

/**
 * Restricts the `/api/v1/admin` surface to keys carrying `scope = 'ai_admin'`.
 *
 * Primary authentication is performed upstream by the global ApiKeyGuard, which
 * resolves the `api_keys` row, populates `tenantContext`, and stashes the
 * resolved `authScope` on the request. This guard only checks that scope.
 */
@Injectable()
export class AdminAiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { authScope?: string }>();
    const resolvedScope = request.authScope;

    if (resolvedScope === ADMIN_KEY_SCOPE) return true;

    if (typeof resolvedScope === 'string') {
      // Authenticated via some other key (e.g. an owner key) but lacking the
      // admin scope.
      throw new ForbiddenException('This key is not authorized for the admin surface.');
    }

    // No api-key resolution at all → 401, same contract as other tenant-gated
    // endpoints.
    throw new UnauthorizedException('This endpoint requires an AI-admin key (mnfst_admin_ai_*).');
  }
}
