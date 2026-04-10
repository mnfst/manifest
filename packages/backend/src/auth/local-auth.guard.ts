import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import {
  LOCAL_USER_ID,
  LOCAL_EMAIL,
  readLocalNotificationEmail,
} from '../common/constants/local-mode.constants';
import { isAllowedLocalIp } from '../common/utils/local-ip';

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
    if (isAllowedLocalIp(clientIp)) {
      const configEmail = readLocalNotificationEmail();
      (request as Request & { user: unknown }).user = {
        id: LOCAL_USER_ID,
        name: 'Local User',
        email: configEmail ?? LOCAL_EMAIL,
      };
      (request as Request & { authMethod: string }).authMethod = 'session';
      return true;
    }

    // Non-loopback without API key: deny access
    return false;
  }
}
