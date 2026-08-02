import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { ApiKey } from '../entities/api-key.entity';
import { CliAuthCode } from '../entities/cli-auth-code.entity';
import { TenantContext } from '../common/decorators/tenant-context.decorator';
import { hashKey, keyPrefix, verifyKey } from '../common/utils/hash.util';
import { toLocalSqlTimestamp } from '../common/utils/postgres-sql';

export const CLI_KEY_NAME = 'cli';
export const CODE_TTL_MS = 5 * 60 * 1000;
const PAT_PREFIX = 'mnfst_pat_';

const INVALID_CODE = 'Invalid or expired authorization code';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * One-time-code handshake for the CLI browser login. The PAT is minted at
 * exchange time so no raw secret is ever at rest; codes are stored hashed and
 * deleted before minting, which makes double-use lose the race even across
 * concurrent regional replicas.
 */
@Injectable()
export class CliAuthService {
  constructor(
    @InjectRepository(CliAuthCode)
    private readonly codeRepo: Repository<CliAuthCode>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    private readonly configService: ConfigService,
  ) {}

  async createAuthorization(ctx: TenantContext, state: string): Promise<{ code: string }> {
    // Sweep against a JS-computed cutoff, not CURRENT_TIMESTAMP: expiries are
    // written with toLocalSqlTimestamp(), so the sweep must read the same clock.
    await this.codeRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: toLocalSqlTimestamp() })
      .execute();

    const code = randomBytes(32).toString('base64url');
    await this.codeRepo.insert({
      id: randomUUID(),
      code_hash: sha256Hex(code),
      state,
      tenant_id: ctx.tenantId as string,
      user_id: ctx.userId,
      expires_at: toLocalSqlTimestamp(new Date(Date.now() + CODE_TTL_MS)),
    });
    return { code };
  }

  async exchange(code: string, state: string): Promise<{ token: string; expiresAt: string }> {
    const row = await this.codeRepo.findOne({ where: { code_hash: sha256Hex(code) } });
    if (!row || row.state !== state) throw new BadRequestException(INVALID_CODE);
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException(INVALID_CODE);
    }
    // Delete before minting: whoever loses this race gets nothing.
    const deleted = await this.codeRepo.delete({ id: row.id });
    if (!deleted.affected) throw new BadRequestException(INVALID_CODE);

    const ttlDays = this.configService.get<number>('app.cliTokenTtlDays', 30);
    const token = PAT_PREFIX + randomBytes(32).toString('base64url');
    // One instant, two renderings: naive-local for the DB column (the format
    // every other writer of expires_at uses), ISO-UTC on the wire so the CLI
    // never has to guess the server's timezone.
    const expiresDate = new Date(Date.now() + ttlDays * 86_400_000);
    await this.apiKeyRepo.insert({
      id: randomUUID(),
      key: null,
      key_hash: hashKey(token),
      key_prefix: keyPrefix(token),
      tenant_id: row.tenant_id,
      created_by_user_id: row.user_id,
      name: CLI_KEY_NAME,
      expires_at: toLocalSqlTimestamp(expiresDate),
    });
    return { token, expiresAt: expiresDate.toISOString() };
  }

  async revokeByRawKey(rawKey: string): Promise<{ revoked: boolean }> {
    const candidates = await this.apiKeyRepo.find({
      where: { key_prefix: keyPrefix(rawKey), name: CLI_KEY_NAME },
    });
    const found = candidates.find((c) => verifyKey(rawKey, c.key_hash));
    if (!found) return { revoked: false };
    await this.apiKeyRepo.delete({ id: found.id });
    return { revoked: true };
  }
}
