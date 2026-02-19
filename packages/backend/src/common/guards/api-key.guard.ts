import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { ApiKey } from '../../entities/api-key.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { sha256 } from '../utils/hash.util';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // Skip if already authenticated via session
    if ((request as Request & { user?: unknown }).user) return true;

    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      this.logger.warn(`Rejected request without API key from ${request.ip}`);
      throw new UnauthorizedException('X-API-Key header required');
    }

    // Try DB-based API key lookup first (multi-tenant)
    const hash = sha256(apiKey);
    const found = await this.apiKeyRepo.findOne({ where: { key_hash: hash } });

    if (found) {
      (request as Request & { apiKeyUserId: string }).apiKeyUserId = String(found.user_id);
      this.apiKeyRepo.update({ key_hash: hash }, { last_used_at: () => 'NOW()' } as never)
        .catch(() => {});
      return true;
    }

    // Fall back to env-based API key (for simple setups)
    const validKey = this.configService.get<string>('app.apiKey', '');
    if (validKey && this.safeCompare(apiKey, validKey)) {
      return true;
    }

    this.logger.warn(`Rejected invalid API key from ${request.ip}`);
    throw new UnauthorizedException('Invalid API key');
  }

  private safeCompare(a: string, b: string): boolean {
    const maxLen = Math.max(a.length, b.length);
    const aBuf = Buffer.alloc(maxLen);
    const bBuf = Buffer.alloc(maxLen);
    Buffer.from(a).copy(aBuf);
    Buffer.from(b).copy(bBuf);
    return a.length === b.length && timingSafeEqual(aBuf, bBuf);
  }
}
