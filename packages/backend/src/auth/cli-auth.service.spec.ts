import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CliAuthService, CODE_TTL_MS } from './cli-auth.service';
import { hashKey } from '../common/utils/hash.util';

function makeService() {
  const codeRepo = {
    insert: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    }),
  };
  const apiKeyRepo = {
    insert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const config = { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService;
  const service = new CliAuthService(codeRepo as never, apiKeyRepo as never, config);
  return { service, codeRepo, apiKeyRepo };
}

/** `YYYY-MM-DD HH:MM:SS` — what toLocalSqlTimestamp() emits. */
const LOCAL_SQL_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

describe('CliAuthService', () => {
  it('createAuthorization stores a hashed code bound to state and tenant', async () => {
    const { service, codeRepo } = makeService();
    const { code } = await service.createAuthorization(
      { tenantId: 't1', userId: 'u1' },
      'state-abcdef1234567890',
    );
    expect(code).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const inserted = codeRepo.insert.mock.calls[0][0];
    expect(inserted.code_hash).toHaveLength(64);
    expect(inserted.code_hash).not.toContain(code);
    expect(inserted.state).toBe('state-abcdef1234567890');
    expect(inserted.tenant_id).toBe('t1');
    expect(inserted.user_id).toBe('u1');
    expect(inserted.expires_at).toMatch(LOCAL_SQL_TIMESTAMP);
    // toLocalSqlTimestamp truncates to whole seconds, so allow a 1s floor slack.
    expect(new Date(inserted.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(inserted.expires_at).getTime()).toBeLessThanOrEqual(
      Date.now() + CODE_TTL_MS + 1000,
    );
  });

  it('createAuthorization sweeps expired rows against a JS-computed cutoff', async () => {
    const { service, codeRepo } = makeService();
    await service.createAuthorization({ tenantId: 't1', userId: null }, 'state-abcdef1234567890');
    expect(codeRepo.createQueryBuilder).toHaveBeenCalled();
    const qb = codeRepo.createQueryBuilder.mock.results[0].value;
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith('expires_at < :now', {
      now: expect.stringMatching(LOCAL_SQL_TIMESTAMP),
    });
    expect(qb.execute).toHaveBeenCalled();
  });

  it('exchange mints a cli PAT with sliding expiry and deletes the code', async () => {
    const { service, codeRepo, apiKeyRepo } = makeService();
    codeRepo.findOne.mockResolvedValue({
      id: 'row1',
      state: 's1-abcdef1234567890',
      tenant_id: 't1',
      user_id: 'u1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    const { token, expiresAt } = await service.exchange('rawcode', 's1-abcdef1234567890');
    expect(token).toMatch(/^mnfst_pat_/);
    expect(codeRepo.delete).toHaveBeenCalledWith({ id: 'row1' });
    const key = apiKeyRepo.insert.mock.calls[0][0];
    expect(key.name).toBe('cli');
    expect(key.tenant_id).toBe('t1');
    expect(key.created_by_user_id).toBe('u1');
    expect(key.key).toBeNull();
    expect(key.key_prefix).toBe(token.substring(0, 12));
    // Persisted naive-local for the DB, returned ISO-UTC on the wire — same instant.
    expect(key.expires_at).toMatch(LOCAL_SQL_TIMESTAMP);
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(key.expires_at).getTime()).toBe(
      Math.floor(new Date(expiresAt).getTime() / 1000) * 1000,
    );
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(new Date(expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 30 * 86_400_000 + 1000);
  });

  it('exchange rejects an unknown code', async () => {
    const { service, codeRepo } = makeService();
    codeRepo.findOne.mockResolvedValue(null);
    await expect(service.exchange('nope', 's1-abcdef1234567890')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('exchange rejects a state mismatch without consuming the code', async () => {
    const { service, codeRepo } = makeService();
    codeRepo.findOne.mockResolvedValue({
      id: 'row1',
      state: 'expected-state-123456',
      tenant_id: 't1',
      user_id: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(service.exchange('rawcode', 'wrong-state-1234567890')).rejects.toThrow(
      BadRequestException,
    );
    expect(codeRepo.delete).not.toHaveBeenCalled();
  });

  it('exchange rejects an expired code', async () => {
    const { service, codeRepo, apiKeyRepo } = makeService();
    codeRepo.findOne.mockResolvedValue({
      id: 'row1',
      state: 's1-abcdef1234567890',
      tenant_id: 't1',
      user_id: null,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(service.exchange('rawcode', 's1-abcdef1234567890')).rejects.toThrow(
      BadRequestException,
    );
    expect(apiKeyRepo.insert).not.toHaveBeenCalled();
  });

  it('exchange loses the race when the row was already consumed', async () => {
    const { service, codeRepo, apiKeyRepo } = makeService();
    codeRepo.findOne.mockResolvedValue({
      id: 'row1',
      state: 's1-abcdef1234567890',
      tenant_id: 't1',
      user_id: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    codeRepo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.exchange('rawcode', 's1-abcdef1234567890')).rejects.toThrow(
      BadRequestException,
    );
    expect(apiKeyRepo.insert).not.toHaveBeenCalled();
  });

  it('revokeByRawKey deletes only a matching cli-named key', async () => {
    const { service, apiKeyRepo } = makeService();
    apiKeyRepo.find.mockResolvedValue([
      { id: 'k1', key_hash: hashKey('mnfst_pat_abc'), name: 'cli' },
    ]);
    await expect(service.revokeByRawKey('mnfst_pat_abc')).resolves.toEqual({ revoked: true });
    expect(apiKeyRepo.find).toHaveBeenCalledWith({
      where: { key_prefix: 'mnfst_pat_ab', name: 'cli' },
    });
    expect(apiKeyRepo.delete).toHaveBeenCalledWith({ id: 'k1' });
  });

  it('revokeByRawKey is a no-op for unknown keys', async () => {
    const { service, apiKeyRepo } = makeService();
    apiKeyRepo.find.mockResolvedValue([]);
    await expect(service.revokeByRawKey('mnfst_pat_zzz')).resolves.toEqual({ revoked: false });
    expect(apiKeyRepo.delete).not.toHaveBeenCalled();
  });
});
