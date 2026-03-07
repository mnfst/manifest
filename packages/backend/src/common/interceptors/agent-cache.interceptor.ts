import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

interface RequestWithIngestion extends Request {
  ingestionContext?: { agentId?: string };
}

@Injectable()
export class AgentCacheInterceptor extends CacheInterceptor {
  constructor(@Inject('CACHE_MANAGER') cacheManager: unknown, reflector: Reflector) {
    super(cacheManager, reflector);
  }

  protected trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest<RequestWithIngestion>();
    const agentId = request.ingestionContext?.agentId;
    if (!agentId) return undefined;

    return `agent:${agentId}:${request.originalUrl}`;
  }
}
