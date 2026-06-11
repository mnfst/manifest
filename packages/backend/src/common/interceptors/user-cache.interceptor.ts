import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class UserCacheInterceptor extends CacheInterceptor {
  constructor(@Inject('CACHE_MANAGER') cacheManager: unknown, reflector: Reflector) {
    super(cacheManager, reflector);
  }

  /**
   * Shared precondition gate for cacheable per-user GET responses. Returns the
   * authenticated user id when the request is a GET carrying a logged-in user,
   * or undefined (skip caching) otherwise. Subclasses build their cache key on
   * top of this so the GET/auth preconditions live in exactly one place.
   */
  protected resolveUserId(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method !== 'GET') return undefined;
    const user = (request as unknown as Record<string, unknown>).user as
      | { id?: string }
      | undefined;
    return user?.id;
  }

  protected trackBy(context: ExecutionContext): string | undefined {
    const userId = this.resolveUserId(context);
    if (!userId) return undefined;

    const request = context.switchToHttp().getRequest<Request>();
    return `${userId}:${request.originalUrl}`;
  }
}
