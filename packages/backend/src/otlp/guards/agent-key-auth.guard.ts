import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Request } from 'express';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import { verifyKey, keyPrefix as computePrefix } from '../../common/utils/hash.util';
import { API_KEY_PREFIX } from '../../common/constants/api-key.constants';
import { isLoopbackIp } from '../../common/utils/local-ip';
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
export class AgentKeyAuthGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(AgentKeyAuthGuard.name);
  private cache = new Map<string, CachedKey>();
  private devContext: { context: IngestionContext; expiresAt: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 10_000;
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(AgentApiKey)
    private readonly keyRepo: Repository<AgentApiKey>,
    private readonly configService: ConfigService,
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

    const ip = request.ip ?? '';
    const isDevLoopback =
      this.configService.get<string>('app.nodeEnv') === 'development' && isLoopbackIp(ip);

    if (!authHeader) {
      if (await this.handleDevLoopback(request, isDevLoopback)) return true;
      this.logger.warn(`Request without auth from ${request.ip}`);
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (!token) {
      throw new UnauthorizedException('Empty token');
    }

    if (!token.startsWith(API_KEY_PREFIX)) {
      if (await this.handleDevLoopback(request, isDevLoopback)) return true;
      throw new UnauthorizedException('Invalid API key format');
    }

    if (token.length < MIN_TOKEN_LENGTH) {
      throw new UnauthorizedException('Invalid API key format');
    }

    return this.validateMnfstToken(request, token);
  }

  invalidateCache(key: string) {
    this.cache.delete(cacheKey(key));
  }

  clearCache() {
    this.cache.clear();
  }

  private setContext(request: Request, ctx: IngestionContext): void {
    (request as Request & { ingestionContext: IngestionContext }).ingestionContext = ctx;
  }

  private async handleDevLoopback(request: Request, isDevLoopback: boolean): Promise<boolean> {
    if (!isDevLoopback) return false;
    const devCtx = await this.resolveDevContext();
    if (!devCtx) return false;
    this.setContext(request, devCtx);
    return true;
  }

  private async validateMnfstToken(request: Request, token: string): Promise<boolean> {
    const cached = this.cache.get(cacheKey(token));
    if (cached && cached.expiresAt > Date.now()) {
      this.setContext(request, {
        tenantId: cached.tenantId,
        agentId: cached.agentId,
        agentName: cached.agentName,
        userId: cached.userId,
      });
      return true;
    }

    const prefix = computePrefix(token);
    const candidates = await this.keyRepo
      .createQueryBuilder('k')
      .leftJoinAndSelect('k.agent', 'a')
      .leftJoinAndSelect('k.tenant', 't')
      .where('k.key_prefix = :prefix', { prefix })
      .andWhere('k.is_active = true')
      .getMany();

    const keyRecord = candidates.find((c) => verifyKey(token, c.key_hash));

    if (!keyRecord) {
      this.logger.warn(`Rejected unknown agent key: ${token.substring(0, 8)}...`);
      throw new UnauthorizedException('Invalid API key');
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    this.keyRepo
      .createQueryBuilder()
      .update(AgentApiKey)
      .set({ last_used_at: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: keyRecord.id })
      .execute()
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

    this.setContext(request, {
      tenantId: keyRecord.tenant_id,
      agentId: keyRecord.agent_id,
      agentName: keyRecord.agent.name,
      userId: keyRecord.tenant.name,
    });

    return true;
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
