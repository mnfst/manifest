import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { LOCAL_USER_ID, LOCAL_EMAIL } from '../common/constants/local-mode.constants';

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

@Injectable()
export class LocalAuthGuard implements CanActivate {
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

    const clientIp = request.ip ?? '';
    if (LOOPBACK_IPS.has(clientIp)) {
      (request as Request & { user: unknown }).user = {
        id: LOCAL_USER_ID,
        name: 'Local User',
        email: LOCAL_EMAIL,
      };
      return true;
    }

    // Non-loopback without API key: deny access
    return false;
  }
}
