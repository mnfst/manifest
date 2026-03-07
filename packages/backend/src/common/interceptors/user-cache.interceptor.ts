import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class UserCacheInterceptor extends CacheInterceptor {
  constructor(@Inject('CACHE_MANAGER') cacheManager: unknown, reflector: Reflector) {
    super(cacheManager, reflector);
  }

  protected trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method !== 'GET') return undefined;
    const user = (request as unknown as Record<string, unknown>).user as
      | { id?: string }
      | undefined;
    if (!user?.id) return undefined;

    return `${user.id}:${request.originalUrl}`;
  }
}
