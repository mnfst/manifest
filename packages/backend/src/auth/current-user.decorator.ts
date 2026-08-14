import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
  // Without a user we can't filter analytics by tenant. Fail closed with a
  // 401 instead of letting the controller crash with `Cannot read 'id' of
  // undefined` (which would surface as a 500 + stack trace in dev).
  if (!request.user) {
    throw new UnauthorizedException(
      'This endpoint requires a user-scoped credential (session cookie or per-user API key).',
    );
  }
  return request.user;
});
