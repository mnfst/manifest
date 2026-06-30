import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
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
import { isLoopbackPeer } from '../../common/utils/local-ip';
const MIN_TOKEN_LENGTH = 12;

function cacheKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface CachedKey {
  tenantId: string;
  agentId: string;
  agentName: string;
  userId: string | null;
  // When this cache entry stops being trusted (the 5-min cache TTL).
  expiresAt: number;
  // The API key's OWN expiry (epoch ms) copied off the DB row, or null when
  // the key never expires. Distinct from `expiresAt`: a key can be set to
  // expire while still inside the cache TTL window, so the fast path must
  // honor this independently instead of trusting the cache entry until the
  // TTL lapses.
  keyExpiresAt: number | null;
}

@Injectable()
export class AgentKeyAuthGuard implements CanActivate, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentKeyAuthGuard.name);
  private cache = new Map<string, CachedKey>();
  private devContext: { context: IngestionContext; expiresAt: number } | null = null;
  // 5 min TTL keeps revoked-key staleness bounded while still amortizing the
  // DB lookup across hot ingest bursts. Mutations call invalidateCache()
  // directly when keys rotate or deactivate.
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 10_000;
  // Maps a rejected token's hash to when its rejection stops being trusted.
  // Without this, every request bearing a wrong/revoked mnfst_ key runs a
  // fresh indexed DB lookup AND emits a warn log — so a single misconfigured
  // agent in a retry loop sustains DB load and floods the logs indefinitely.
  // The TTL is deliberately much shorter than CACHE_TTL_MS so a key that gets
  // created or reactivated starts working quickly; key mutations also clear
  // this via clearCache()/invalidateCache(), so a created key is never stuck.
  private negativeCache = new Map<string, number>();
  private readonly NEGATIVE_CACHE_TTL_MS = 30 * 1000;
  private readonly MAX_NEGATIVE_CACHE_SIZE = 10_000;
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

  async onModuleInit(): Promise<void> {
    // Pre-migration API keys were hashed with a static salt
    // ("manifest-api-key-salt"). The verifyKey path still accepts them for
    // backward compatibility, but a leaked DB backup gives an attacker a
    // rainbow-table head start. Surface a one-shot warning so operators
    // know to rotate them via the dashboard.
    try {
      const legacyCount = await this.keyRepo
        .createQueryBuilder('k')
        .where("k.key_hash NOT LIKE '%:%'")
        .andWhere('k.is_active = true')
        .getCount();
      if (legacyCount > 0) {
        this.logger.warn(
          `${legacyCount} active agent API key(s) still use the legacy static-salt hash. ` +
            'Rotate them in the dashboard (Agent → Rotate Key) when convenient.',
        );
      }
    } catch (err) {
      // Don't block boot on this informational check (e.g. fresh DB before
      // migrations run on the very first boot of an old install).
      this.logger.debug(`Legacy hash audit skipped: ${(err as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    // Use socket.remoteAddress (TCP peer) — request.ip honors X-Forwarded-For
    // and is spoofable when `trust proxy` is enabled.
    const isDevLoopback =
      this.configService.get<string>('app.nodeEnv') === 'development' && isLoopbackPeer(request);

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
    const hashed = cacheKey(key);
    this.cache.delete(hashed);
    // Drop any negative entry too, so re-creating or rotating a key that was
    // briefly rejected (e.g. a client raced ahead of key creation) takes
    // effect immediately instead of waiting out the negative TTL.
    this.negativeCache.delete(hashed);
  }

  clearCache() {
    this.cache.clear();
    this.negativeCache.clear();
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
    const hashed = cacheKey(token);
    const now = Date.now();

    // Negative cache first: a recently-rejected token short-circuits here
    // without touching the DB or emitting a log line. This is what collapses
    // a wrong/revoked-key storm to one DB lookup + one warn per TTL window.
    const negativeExpiry = this.negativeCache.get(hashed);
    if (negativeExpiry !== undefined && negativeExpiry > now) {
      // LRU touch — re-insert to move to tail of insertion order.
      this.negativeCache.delete(hashed);
      this.negativeCache.set(hashed, negativeExpiry);
      throw new UnauthorizedException('Invalid API key');
    }
    if (negativeExpiry !== undefined) {
      // Stale negative entry — drop it and re-check against the DB so a key
      // that has since been created/reactivated can authenticate again.
      this.negativeCache.delete(hashed);
    }

    const cached = this.cache.get(hashed);
    // A key whose own expiry has passed must stop authenticating immediately,
    // even if its cache entry is still inside the 5-min TTL. Drop the stale
    // entry and fall through to the DB path (which re-checks expiry and rejects
    // with "API key expired") rather than honoring it here.
    if (cached && cached.keyExpiresAt !== null && cached.keyExpiresAt <= now) {
      this.cache.delete(hashed);
    } else if (cached && cached.expiresAt > now) {
      // LRU touch — re-insert to move to tail of insertion order
      this.cache.delete(hashed);
      this.cache.set(hashed, cached);
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
      .select([
        'k.id',
        'k.key_hash',
        'k.tenant_id',
        'k.agent_id',
        'k.expires_at',
        'a.name',
        't.owner_user_id',
      ])
      .leftJoin('k.agent', 'a')
      .leftJoin('k.tenant', 't')
      .where('k.key_prefix = :prefix', { prefix })
      .andWhere('k.is_active = true')
      .andWhere('a.deleted_at IS NULL')
      .getMany();

    const keyRecord = candidates.find((c) => verifyKey(token, c.key_hash));

    if (!keyRecord) {
      // Remember the rejection so an identical repeat is served from the
      // negative cache (no DB, no log) until the short TTL lapses.
      this.rememberInvalid(hashed);
      // Log only the fixed prefix — even leaking the next character or two
      // narrows the search space if these warnings end up in a SIEM that
      // retains them indefinitely.
      this.logger.warn(`Rejected unknown agent key (prefix: ${API_KEY_PREFIX}...)`);
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
    while (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      this.cache.delete(firstKey);
    }

    this.cache.set(hashed, {
      tenantId: keyRecord.tenant_id,
      agentId: keyRecord.agent_id,
      agentName: keyRecord.agent.name,
      userId: keyRecord.tenant.owner_user_id,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
      keyExpiresAt: keyRecord.expires_at ? new Date(keyRecord.expires_at).getTime() : null,
    });

    this.setContext(request, {
      tenantId: keyRecord.tenant_id,
      agentId: keyRecord.agent_id,
      agentName: keyRecord.agent.name,
      userId: keyRecord.tenant.owner_user_id,
    });

    return true;
  }

  private async resolveDevContext(): Promise<IngestionContext | null> {
    if (this.devContext && this.devContext.expiresAt > Date.now()) {
      return this.devContext.context;
    }

    // Prefer the seed tenant when present so a shared dev DB doesn't
    // accidentally route loopback traffic into another developer's data
    // simply because their key was inserted first.
    const seedKey = await this.keyRepo
      .createQueryBuilder('k')
      .leftJoinAndSelect('k.agent', 'a')
      .leftJoinAndSelect('k.tenant', 't')
      .where('k.is_active = true')
      .andWhere('k.tenant_id = :tid', { tid: 'seed-tenant-001' })
      .getOne();

    const keyRecord =
      seedKey ??
      (await this.keyRepo.findOne({
        where: { is_active: true },
        relations: ['agent', 'tenant'],
      }));

    if (!keyRecord) return null;

    const ctx: IngestionContext = {
      tenantId: keyRecord.tenant_id,
      agentId: keyRecord.agent_id,
      agentName: keyRecord.agent.name,
      userId: keyRecord.tenant.owner_user_id,
    };

    this.devContext = { context: ctx, expiresAt: Date.now() + this.CACHE_TTL_MS };
    return ctx;
  }

  private rememberInvalid(hashed: string): void {
    this.evictExpired();
    while (this.negativeCache.size >= this.MAX_NEGATIVE_CACHE_SIZE) {
      const firstKey = this.negativeCache.keys().next().value;
      if (firstKey === undefined) break;
      this.negativeCache.delete(firstKey);
    }
    this.negativeCache.set(hashed, Date.now() + this.NEGATIVE_CACHE_TTL_MS);
  }

  private evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
    for (const [key, expiresAt] of this.negativeCache) {
      if (expiresAt <= now) this.negativeCache.delete(key);
    }
  }
}
