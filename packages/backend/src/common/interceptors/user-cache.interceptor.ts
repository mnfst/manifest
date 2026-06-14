import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RequestWithTenantContext } from '../decorators/tenant-context.decorator';

@Injectable()
export class UserCacheInterceptor extends CacheInterceptor {
  constructor(@Inject('CACHE_MANAGER') cacheManager: unknown, reflector: Reflector) {
    super(cacheManager, reflector);
  }

  /**
   * Shared precondition gate for cacheable per-tenant GET responses. Returns
   * the resolved tenant id when the request is a GET carrying an authenticated
   * tenant context, or undefined (skip caching) otherwise. Subclasses build
   * their cache key on top of this so the GET/auth preconditions live in
   * exactly one place. Keyed by tenant — never by user — so the cache scope
   * matches the data scope.
   */
  protected resolveTenantId(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();
    if (request.method !== 'GET') return undefined;
    return request.tenantContext?.tenantId ?? undefined;
  }

  protected trackBy(context: ExecutionContext): string | undefined {
    const tenantId = this.resolveTenantId(context);
    if (!tenantId) return undefined;

    const request = context.switchToHttp().getRequest<Request>();
    return `${tenantId}:${request.originalUrl}`;
  }
}
