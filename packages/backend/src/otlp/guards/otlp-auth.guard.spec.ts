import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OtlpAuthGuard } from './otlp-auth.guard';

function makeContext(headers: Record<string, string | undefined>, ip = '10.0.0.1') {
  const request: Record<string, unknown> = { headers, ip };
  return {
    req: request,
    ctx: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext,
  };
}

describe('OtlpAuthGuard', () => {
  let guard: OtlpAuthGuard;
  let mockGetOne: jest.Mock;
  let mockCreateQueryBuilder: jest.Mock;
  let mockUpdate: jest.Mock;

  beforeEach(() => {
    mockGetOne = jest.fn().mockResolvedValue(null);
    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: mockGetOne,
    };
    mockCreateQueryBuilder = jest.fn().mockReturnValue(mockQb);
    mockUpdate = jest.fn().mockResolvedValue({});
    const mockRepo = { createQueryBuilder: mockCreateQueryBuilder, update: mockUpdate } as never;
    guard = new OtlpAuthGuard(mockRepo);
    guard.clearCache();
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Authorization header required');
  });

  it('throws UnauthorizedException when token is empty (Bearer with no value)', async () => {
    const { ctx } = makeContext({ authorization: 'Bearer ' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Empty token');
  });

  it('rejects token without mnfst_ prefix', async () => {
    const { ctx } = makeContext({ authorization: 'Bearer osk_some_old_key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key format');
    expect(mockCreateQueryBuilder).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when API key is not found in DB', async () => {
    mockGetOne.mockResolvedValue(null);
    const { ctx } = makeContext({ authorization: 'Bearer mnfst_unknown-key' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid API key');
  });

  it('returns true and attaches ingestionContext when key is valid', async () => {
    mockGetOne.mockResolvedValue({
      tenant_id: 'tenant-1',
      agent_id: 'agent-1',
      expires_at: null,
      agent: { name: 'test-agent' },
      tenant: { name: 'user-1' },
    });

    const { ctx, req } = makeContext({ authorization: 'Bearer mnfst_valid-key' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.ingestionContext).toEqual({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      agentName: 'test-agent',
      userId: 'user-1',
    });
  });

  it('returns true when raw token (no Bearer prefix) matches', async () => {
    mockGetOne.mockResolvedValue({
      tenant_id: 'tenant-2',
      agent_id: 'agent-2',
      expires_at: null,
      agent: { name: 'test-agent-2' },
      tenant: { name: 'user-2' },
    });

    const { ctx, req } = makeContext({ authorization: 'mnfst_raw-key' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.ingestionContext).toEqual({
      tenantId: 'tenant-2',
      agentId: 'agent-2',
      agentName: 'test-agent-2',
      userId: 'user-2',
    });
  });

  it('throws UnauthorizedException when API key is expired', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockGetOne.mockResolvedValue({
      tenant_id: 'tenant-1',
      agent_id: 'agent-1',
      expires_at: pastDate,
      agent: { name: 'test-agent' },
      tenant: { name: 'user-1' },
    });

    const { ctx } = makeContext({ authorization: 'Bearer mnfst_expired-key' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('API key expired');
  });

  it('uses cached result on second call without querying DB again', async () => {
    mockGetOne.mockResolvedValue({
      tenant_id: 'tenant-1',
      agent_id: 'agent-1',
      expires_at: null,
      agent: { name: 'test-agent' },
      tenant: { name: 'user-1' },
    });

    const { ctx: ctx1 } = makeContext({ authorization: 'Bearer mnfst_cached-key' });
    await guard.canActivate(ctx1);

    expect(mockCreateQueryBuilder).toHaveBeenCalledTimes(1);

    mockCreateQueryBuilder.mockClear();
    mockGetOne.mockClear();

    const { ctx: ctx2 } = makeContext({ authorization: 'Bearer mnfst_cached-key' });
    await guard.canActivate(ctx2);

    expect(mockCreateQueryBuilder).not.toHaveBeenCalled();
  });

  describe('loopback bypass in local mode', () => {
    const origMode = process.env['MANIFEST_MODE'];

    afterEach(() => {
      if (origMode === undefined) delete process.env['MANIFEST_MODE'];
      else process.env['MANIFEST_MODE'] = origMode;
    });

    it('allows loopback requests without auth in local mode', async () => {
      process.env['MANIFEST_MODE'] = 'local';
      const { ctx, req } = makeContext({}, '127.0.0.1');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.ingestionContext).toEqual({
        tenantId: 'local-tenant-001',
        agentId: 'local-agent-001',
        agentName: 'local-agent',
        userId: 'local-user-001',
      });
      expect(mockCreateQueryBuilder).not.toHaveBeenCalled();
    });

    it('allows ::1 loopback without auth in local mode', async () => {
      process.env['MANIFEST_MODE'] = 'local';
      const { ctx, req } = makeContext({}, '::1');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.ingestionContext).toEqual({
        tenantId: 'local-tenant-001',
        agentId: 'local-agent-001',
        agentName: 'local-agent',
        userId: 'local-user-001',
      });
    });

    it('still requires auth for non-loopback IPs in local mode', async () => {
      process.env['MANIFEST_MODE'] = 'local';
      const { ctx } = makeContext({}, '192.168.1.100');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('still requires auth for loopback IPs when not in local mode', async () => {
      process.env['MANIFEST_MODE'] = 'cloud';
      const { ctx } = makeContext({}, '127.0.0.1');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('still requires auth when MANIFEST_MODE is unset', async () => {
      delete process.env['MANIFEST_MODE'];
      const { ctx } = makeContext({}, '127.0.0.1');
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  it('invalidateCache removes a specific key from cache', async () => {
    mockGetOne.mockResolvedValue({
      tenant_id: 'tenant-1',
      agent_id: 'agent-1',
      expires_at: null,
      agent: { name: 'test-agent' },
      tenant: { name: 'user-1' },
    });

    const { ctx } = makeContext({ authorization: 'Bearer mnfst_inv-key' });
    await guard.canActivate(ctx);

    guard.invalidateCache('mnfst_inv-key');
    mockCreateQueryBuilder.mockClear();
    mockGetOne.mockClear();

    mockGetOne.mockResolvedValue({
      tenant_id: 'tenant-1',
      agent_id: 'agent-1',
      expires_at: null,
      agent: { name: 'test-agent' },
      tenant: { name: 'user-1' },
    });

    const mockQb2 = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: mockGetOne,
    };
    mockCreateQueryBuilder.mockReturnValue(mockQb2);

    const { ctx: ctx2 } = makeContext({ authorization: 'Bearer mnfst_inv-key' });
    await guard.canActivate(ctx2);

    expect(mockCreateQueryBuilder).toHaveBeenCalledTimes(1);
  });
});
