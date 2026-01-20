import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { AppAccessService } from './app-access.service';
import type { Session } from './decorators/current-user.decorator';

/**
 * Guard to check if a user has access to a specific app
 * Returns 404 (not 403) for unauthorized access to prevent information leakage
 *
 * IMPORTANT: This guard must be applied AFTER AuthGuard to ensure session exists
 *
 * Usage:
 * @UseGuards(AppAccessGuard)
 * @Get(':appId')
 * getApp(@Param('appId') appId: string) { ... }
 */
@Injectable()
export class AppAccessGuard implements CanActivate {
  constructor(private readonly appAccessService: AppAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.session as Session | undefined;

    // If no session, let AuthGuard handle it (should return 401)
    if (!session?.user?.id) {
      return true;
    }

    // Get appId from route params
    const appId = request.params.appId || request.params.id;

    if (!appId) {
      // No appId in route, nothing to check
      return true;
    }

    const hasAccess = await this.appAccessService.hasAccess(session.user.id, appId);

    if (!hasAccess) {
      // Return 404 to prevent information leakage about resource existence
      throw new NotFoundException('App not found');
    }

    return true;
  }
}
