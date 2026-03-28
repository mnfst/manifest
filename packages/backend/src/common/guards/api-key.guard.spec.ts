import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';
import { hashKey } from '../utils/hash.util';

function makeContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        ip: '127.0.0.1',
        apiKeyUserId: undefined,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockFind: jest.Mock;
  let mockExecute: jest.Mock;
  let configGet: jest.Mock;
  let reflector: Reflector;

  beforeEach(() => {
    mockFind = jest.fn().mockResolvedValue([]);
    mockExecute = jest.fn().mockResolvedValue({});
    const mockUpdateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockImplementation((setObj) => {
        // Invoke raw expression functions for coverage (e.g. () => 'CURRENT_TIMESTAMP')
        if (setObj) {
          for (const val of Object.values(setObj)) {
            if (typeof val === 'function') (val as () => unknown)();
          }
        }
        return mockUpdateQb;
      }),
      where: jest.fn().mockReturnThis(),
      execute: mockExecute,
    };
    configGet = jest.fn().mockReturnValue('');
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const configService = { get: configGet } as unknown as ConfigService;
    const mockRepo = {
      find: mockFind,
      createQueryBuilder: jest.fn().mockReturnValue(mockUpdateQb),
    } as never;
    guard = new ApiKeyGuard(reflector, configService, mockRepo);
  });

  it('throws UnauthorizedException when X-API-Key header is missing', async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('X-API-Key header required');
  });

  it('throws UnauthorizedException when X-API-Key is not a string', async () => {
    const ctx = makeContext({ 'x-api-key': undefined });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('returns true when API key hash is found in database', async () => {
    const rawKey = 'valid-db-key';
    const storedHash = hashKey(rawKey);
    mockFind.mockResolvedValueOnce([
      {
        id: 'key-1',
        user_id: 'user-123',
        key_hash: storedHash,
        key_prefix: rawKey.substring(0, 12),
      },
    ]);
    const ctx = makeContext({ 'x-api-key': rawKey });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalled();
  });

  it('sets apiKeyUserId on request when DB key matches', async () => {
    const rawKey = 'db-key';
    const storedHash = hashKey(rawKey);
    mockFind.mockResolvedValueOnce([
      {
        id: 'key-1',
        user_id: 'user-456',
        key_hash: storedHash,
        key_prefix: rawKey.substring(0, 12),
      },
    ]);
    const request = {
      headers: { 'x-api-key': rawKey },
      ip: '127.0.0.1',
      apiKeyUserId: undefined as string | undefined,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);
    expect(request.apiKeyUserId).toBe('user-456');
  });

  it('falls back to env-based API key when DB lookup returns empty', async () => {
    mockFind.mockResolvedValueOnce([]);
    configGet.mockReturnValue('env-api-key');
    const ctx = makeContext({ 'x-api-key': 'env-api-key' });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws when neither DB nor env key matches', async () => {
    mockFind.mockResolvedValueOnce([]);
    configGet.mockReturnValue('correct-key');
    const ctx = makeContext({ 'x-api-key': 'wrong-key' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key');
  });

  it('throws when env key is empty and DB lookup fails', async () => {
    mockFind.mockResolvedValueOnce([]);
    configGet.mockReturnValue('');
    const ctx = makeContext({ 'x-api-key': 'any-key' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects keys of different length from env key', async () => {
    mockFind.mockResolvedValueOnce([]);
    configGet.mockReturnValue('short');
    const ctx = makeContext({ 'x-api-key': 'much-longer-key-value' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('does not throw when last_used_at update fails', async () => {
    const rawKey = 'key-that-triggers-update-fail';
    const storedHash = hashKey(rawKey);
    mockFind.mockResolvedValueOnce([
      {
        id: 'key-1',
        user_id: 'user-789',
        key_hash: storedHash,
        key_prefix: rawKey.substring(0, 12),
      },
    ]);
    mockExecute.mockRejectedValueOnce(new Error('DB write error'));
    const ctx = makeContext({ 'x-api-key': rawKey });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalled();
  });

  it('returns true immediately when route is marked @Public()', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(true);
    const ctx = makeContext({});

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('skips API key validation when request.user is already set', async () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          ip: '127.0.0.1',
          user: { id: 'session-user' },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockFind).not.toHaveBeenCalled();
  });
});
