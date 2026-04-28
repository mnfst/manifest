import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.instance';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { isLoopbackIp } from '../common/utils/local-ip';
import { isSelfHosted } from '../common/utils/detect-self-hosted';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // Let API-key authenticated requests be handled by ApiKeyGuard
    if (request.headers['x-api-key']) return true;

    // In the self-hosted version without Better Auth, skip session lookup
    if (!auth) return true;

    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (session) {
        (request as Request & { user: unknown }).user = session.user;
        (request as Request & { session: unknown }).session = session.session;
        (request as Request & { authMethod: string }).authMethod = 'session';
        return true;
      }
    } catch (err) {
      this.logger.warn(`Session lookup failed: ${(err as Error).message}`);
    }

    // In the self-hosted version, fall back to a synthetic user for loopback
    // requests without a session (e.g. curl, programmatic access)
    if (isSelfHosted() && request.ip && isLoopbackIp(request.ip)) {
      (request as Request & { user: unknown }).user = {
        id: 'local',
        name: 'Local User',
        email: 'local@localhost',
      };
      (request as Request & { authMethod: string }).authMethod = 'session';
      return true;
    }

    // Always pass — let ApiKeyGuard handle unauthenticated requests
    return true;
  }
}
