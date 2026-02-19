import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.instance';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

@Injectable()
export class SessionGuard implements CanActivate {
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

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (session) {
      (request as Request & { user: unknown }).user = session.user;
      (request as Request & { session: unknown }).session = session.session;
    }

    // Always pass — let ApiKeyGuard handle unauthenticated requests
    return true;
  }
}
