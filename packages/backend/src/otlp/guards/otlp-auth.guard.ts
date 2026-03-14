import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Request } from 'express';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import { hashKey } from '../../common/utils/hash.util';
import { API_KEY_PREFIX } from '../../common/constants/api-key.constants';
import {
  LOCAL_TENANT_ID,
  LOCAL_AGENT_ID,
  LOCAL_AGENT_NAME,
  LOCAL_USER_ID,
} from '../../common/constants/local-mode.constants';

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const MIN_TOKEN_LENGTH = 12;

function cacheKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface CachedKey {
  tenantId: string;
  agentId: string;
  agentName: string;
  userId: string;
  expiresAt: number;
}

@Injectable()
export class OtlpAuthGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(OtlpAuthGuard.name);
  private cache = new Map<string, CachedKey>();
  private devContext: { context: IngestionContext; expiresAt: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 10_000;
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(AgentApiKey)
    private readonly keyRepo: Repository<AgentApiKey>,
  ) {
    this.cleanupTimer = setInterval(() => this.evictExpired(), 60_000);
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    const isLoopback = LOOPBACK_IPS.has(request.ip ?? '');
    const isLocal = process.env['MANIFEST_MODE'] === 'local' && isLoopback;
    const isDevLoopback = process.env['NODE_ENV'] === 'development' && isLoopback;

    // In local mode, trust loopback connections without requiring an API key.
    // Also handles dev-mode gateways that send a dummy/non-mnfst token.
    if (!authHeader && isLocal) {
      (request as Request & { ingestionContext: IngestionContext }).ingestionContext = {
        tenantId: LOCAL_TENANT_ID,
        agentId: LOCAL_AGENT_ID,
        agentName: LOCAL_AGENT_NAME,
        userId: LOCAL_USER_ID,
      };
      return true;
    }

    // In development, trust loopback connections and resolve to first active agent.
    if (!authHeader && isDevLoopback) {
      const devCtx = await this.resolveDevContext();
      if (devCtx) {
        (request as Request & { ingestionContext: IngestionContext }).ingestionContext = devCtx;
        return true;
      }
    }

    if (!authHeader) {
      this.logger.warn(`OTLP request without auth from ${request.ip}`);
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (!token) {
      throw new UnauthorizedException('Empty token');
    }

    // In local mode, if the token isn't a valid mnfst_ key (e.g. a dev
    // gateway sending a dummy key), fall through to the loopback bypass.
    if (!token.startsWith(API_KEY_PREFIX)) {
      if (isLocal) {
        (request as Request & { ingestionContext: IngestionContext }).ingestionContext = {
          tenantId: LOCAL_TENANT_ID,
          agentId: LOCAL_AGENT_ID,
          agentName: LOCAL_AGENT_NAME,
          userId: LOCAL_USER_ID,
        };
        return true;
      }
      if (isDevLoopback) {
        const devCtx = await this.resolveDevContext();
        if (devCtx) {
          (request as Request & { ingestionContext: IngestionContext }).ingestionContext = devCtx;
          return true;
        }
      }
      throw new UnauthorizedException('Invalid API key format');
    }

    if (token.length < MIN_TOKEN_LENGTH) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const cached = this.cache.get(cacheKey(token));
    if (cached && cached.expiresAt > Date.now()) {
      (request as Request & { ingestionContext: IngestionContext }).ingestionContext = {
        tenantId: cached.tenantId,
        agentId: cached.agentId,
        agentName: cached.agentName,
        userId: cached.userId,
      };
      return true;
    }

    const tokenHash = hashKey(token);
    const keyRecord = await this.keyRepo
      .createQueryBuilder('k')
      .leftJoinAndSelect('k.agent', 'a')
      .leftJoinAndSelect('k.tenant', 't')
      .where('k.key_hash = :tokenHash', { tokenHash })
      .andWhere('k.is_active = true')
      .getOne();

    if (!keyRecord) {
      this.logger.warn(`Rejected unknown OTLP key: ${token.substring(0, 8)}...`);
      throw new UnauthorizedException('Invalid API key');
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    this.keyRepo
      .update({ key_hash: tokenHash }, { last_used_at: () => 'CURRENT_TIMESTAMP' } as never)
      .catch((err: Error) => this.logger.warn(`Failed to update last_used_at: ${err.message}`));

    this.evictExpired();
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey(token), {
      tenantId: keyRecord.tenant_id,
      agentId: keyRecord.agent_id,
      agentName: keyRecord.agent.name,
      userId: keyRecord.tenant.name,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    (request as Request & { ingestionContext: IngestionContext }).ingestionContext = {
      tenantId: keyRecord.tenant_id,
      agentId: keyRecord.agent_id,
      agentName: keyRecord.agent.name,
      userId: keyRecord.tenant.name,
    };

    return true;
  }

  invalidateCache(key: string) {
    this.cache.delete(cacheKey(key));
  }

  clearCache() {
    this.cache.clear();
  }

  private async resolveDevContext(): Promise<IngestionContext | null> {
    if (this.devContext && this.devContext.expiresAt > Date.now()) {
      return this.devContext.context;
    }

    const keyRecord = await this.keyRepo.findOne({
      where: { is_active: true },
      relations: ['agent', 'tenant'],
    });

    if (!keyRecord) return null;

    const ctx: IngestionContext = {
      tenantId: keyRecord.tenant_id,
      agentId: keyRecord.agent_id,
      agentName: keyRecord.agent.name,
      userId: keyRecord.tenant.name,
    };

    this.devContext = { context: ctx, expiresAt: Date.now() + this.CACHE_TTL_MS };
    return ctx;
  }

  private evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }
}
