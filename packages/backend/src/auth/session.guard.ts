import { CanActivate, ExecutionContext, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { createHash } from 'crypto';
import { auth } from './auth.instance';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { isLoopbackPeer } from '../common/utils/local-ip';
import { isSelfHosted } from '../common/utils/detect-self-hosted';

interface CachedSession {
  user: unknown;
  session: unknown;
  expiresAt: number;
}

@Injectable()
export class SessionGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(SessionGuard.name);
  private readonly cache = new Map<string, CachedSession>();
  private readonly CACHE_TTL_MS = 60_000;
  private readonly MAX_CACHE_SIZE = 5_000;
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private readonly reflector: Reflector) {
    this.cleanupTimer = setInterval(() => this.evictExpired(), 60_000);
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

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

    const cookieHeader = request.headers['cookie'];
    const cacheKey =
      typeof cookieHeader === 'string' && cookieHeader.length > 0
        ? this.hashCookie(cookieHeader)
        : null;

    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        // LRU touch — re-insert to move to tail of insertion order
        this.cache.delete(cacheKey);
        this.cache.set(cacheKey, cached);
        (request as Request & { user: unknown }).user = cached.user;
        (request as Request & { session: unknown }).session = cached.session;
        (request as Request & { authMethod: string }).authMethod = 'session';
        return true;
      }
    }

    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (session) {
        (request as Request & { user: unknown }).user = session.user;
        (request as Request & { session: unknown }).session = session.session;
        (request as Request & { authMethod: string }).authMethod = 'session';
        if (cacheKey) this.storeInCache(cacheKey, session.user, session.session);
        return true;
      }
    } catch (err) {
      this.logger.warn(`Session lookup failed: ${(err as Error).message}`);
    }

    // In the self-hosted version, fall back to a synthetic user for loopback
    // requests without a session (e.g. curl, programmatic access).
    //
    // Use the TCP peer address (request.socket.remoteAddress) — request.ip
    // honors `trust proxy` and X-Forwarded-For, which a remote attacker can
    // forge when the backend is reachable directly or sits behind a proxy
    // that fails to strip XFF. The socket address cannot be spoofed.
    if (isSelfHosted() && isLoopbackPeer(request)) {
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

  invalidateCache(cookieHeader?: string): void {
    if (cookieHeader) {
      this.cache.delete(this.hashCookie(cookieHeader));
      return;
    }
    this.cache.clear();
  }

  private hashCookie(cookieHeader: string): string {
    return createHash('sha256').update(cookieHeader).digest('hex');
  }

  private storeInCache(key: string, user: unknown, session: unknown): void {
    this.evictExpired();
    while (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      user,
      session,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }
}
