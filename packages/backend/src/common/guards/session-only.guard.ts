import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/** Restricts user-preference endpoints to an authenticated browser session. */
@Injectable()
export class SessionOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { authMethod?: 'session' | 'api_key' | 'env_api_key' }>();
    if (request.authMethod === 'session') return true;
    throw new UnauthorizedException('This endpoint requires an authenticated user session.');
  }
}
