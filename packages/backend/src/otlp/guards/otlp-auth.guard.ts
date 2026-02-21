import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import { sha256 } from '../../common/utils/hash.util';
import { API_KEY_PREFIX } from '../../common/constants/api-key.constants';

interface CachedKey {
  tenantId: string;
  agentId: string;
  agentName: string;
  userId: string;
  expiresAt: number;
}

@Injectable()
export class OtlpAuthGuard implements CanActivate {
  private readonly logger = new Logger(OtlpAuthGuard.name);
  private cache = new Map<string, CachedKey>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 10_000;

  constructor(
    @InjectRepository(AgentApiKey)
    private readonly keyRepo: Repository<AgentApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      this.logger.warn(`OTLP request without auth from ${request.ip}`);
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      throw new UnauthorizedException('Empty token');
    }

    if (!token.startsWith(API_KEY_PREFIX)) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const cached = this.cache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      (request as Request & { ingestionContext: IngestionContext }).ingestionContext = {
        tenantId: cached.tenantId,
        agentId: cached.agentId,
        agentName: cached.agentName,
        userId: cached.userId,
      };
      return true;
    }

    const tokenHash = sha256(token);
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

    this.keyRepo.update({ key_hash: tokenHash }, { last_used_at: () => 'CURRENT_TIMESTAMP' } as never)
      .catch((err: Error) => this.logger.warn(`Failed to update last_used_at: ${err.message}`));

    this.evictExpired();
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(token, {
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
    this.cache.delete(key);
  }

  clearCache() {
    this.cache.clear();
  }

  private evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }
}
