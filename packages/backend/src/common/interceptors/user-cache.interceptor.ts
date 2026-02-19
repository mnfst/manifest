import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CacheInvalidationService } from '../services/cache-invalidation.service';

@Injectable()
export class UserCacheInterceptor extends CacheInterceptor {
  constructor(
    @Inject('CACHE_MANAGER') cacheManager: unknown,
    reflector: Reflector,
    private readonly invalidation: CacheInvalidationService,
  ) {
    super(cacheManager, reflector);
  }

  protected trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as unknown as Record<string, unknown>).user as { id?: string } | undefined;
    if (!user?.id) return undefined;

    const key = `${user.id}:${request.originalUrl}`;
    this.invalidation.trackKey(user.id, key);
    return key;
  }
}
