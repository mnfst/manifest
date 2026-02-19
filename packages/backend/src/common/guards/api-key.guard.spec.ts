import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';
import { sha256 } from '../utils/hash.util';

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
  let mockFindOne: jest.Mock;
  let mockUpdate: jest.Mock;
  let configGet: jest.Mock;
  let reflector: Reflector;

  beforeEach(() => {
    mockFindOne = jest.fn().mockResolvedValue(null);
    mockUpdate = jest.fn().mockResolvedValue({});
    configGet = jest.fn().mockReturnValue('');
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const configService = { get: configGet } as unknown as ConfigService;
    const mockRepo = { findOne: mockFindOne, update: mockUpdate } as never;
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
    mockFindOne.mockResolvedValueOnce({ user_id: 'user-123' });
    const ctx = makeContext({ 'x-api-key': 'valid-db-key' });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockFindOne).toHaveBeenCalledWith({ where: { key_hash: sha256('valid-db-key') } });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('sets apiKeyUserId on request when DB key matches', async () => {
    mockFindOne.mockResolvedValueOnce({ user_id: 'user-456' });
    const request = {
      headers: { 'x-api-key': 'db-key' },
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
    mockFindOne.mockResolvedValueOnce(null);
    configGet.mockReturnValue('env-api-key');
    const ctx = makeContext({ 'x-api-key': 'env-api-key' });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws when neither DB nor env key matches', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    configGet.mockReturnValue('correct-key');
    const ctx = makeContext({ 'x-api-key': 'wrong-key' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key');
  });

  it('throws when env key is empty and DB lookup fails', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    configGet.mockReturnValue('');
    const ctx = makeContext({ 'x-api-key': 'any-key' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects keys of different length from env key', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    configGet.mockReturnValue('short');
    const ctx = makeContext({ 'x-api-key': 'much-longer-key-value' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
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
    expect(mockFindOne).not.toHaveBeenCalled();
  });
});
