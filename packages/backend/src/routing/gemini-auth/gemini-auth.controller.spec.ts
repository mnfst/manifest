import { BadRequestException } from '@nestjs/common';
import { GeminiAuthController } from './gemini-auth.controller';
import { GeminiAuthService } from './gemini-auth.service';
import { RoutingService } from '../routing.service';
import { ResolveAgentService } from '../resolve-agent.service';
import { Request, Response } from 'express';

describe('GeminiAuthController', () => {
  let controller: GeminiAuthController;
  let geminiAuth: jest.Mocked<GeminiAuthService>;
  let routingService: jest.Mocked<RoutingService>;
  let resolveAgentService: jest.Mocked<ResolveAgentService>;

  const mockReq = {
    protocol: 'http',
    headers: {},
    get: jest.fn().mockReturnValue('localhost:3001'),
  } as unknown as Request;

  const mockRes = {
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  } as unknown as Response;

  const mockUser = { id: 'user-1', name: 'Test', email: 'test@test.com' };

  beforeEach(() => {
    geminiAuth = {
      isConfigured: jest.fn().mockReturnValue(true),
      generateState: jest.fn().mockReturnValue('test-state-123'),
      buildAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2?state=test'),
      exchangeCode: jest.fn().mockResolvedValue('refresh-token-abc'),
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
      getClientId: jest.fn().mockReturnValue('client-id'),
    } as unknown as jest.Mocked<GeminiAuthService>;

    routingService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: true }),
    } as unknown as jest.Mocked<RoutingService>;

    resolveAgentService = {
      resolve: jest.fn().mockResolvedValue({ id: 'agent-id-1', name: 'my-agent' }),
    } as unknown as jest.Mocked<ResolveAgentService>;

    controller = new GeminiAuthController(geminiAuth, routingService, resolveAgentService);

    jest.clearAllMocks();
    // Re-apply defaults after clearAllMocks
    geminiAuth.isConfigured.mockReturnValue(true);
    geminiAuth.generateState.mockReturnValue('test-state-123');
    geminiAuth.buildAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2?state=test');
    geminiAuth.exchangeCode.mockResolvedValue('refresh-token-abc');
    resolveAgentService.resolve.mockResolvedValue({ id: 'agent-id-1', name: 'my-agent' } as never);
    routingService.upsertProvider.mockResolvedValue({ provider: {} as never, isNew: true });
    (mockRes.redirect as jest.Mock).mockClear();
    (mockRes.status as jest.Mock).mockClear().mockReturnThis();
    (mockRes.send as jest.Mock).mockClear();
    (mockReq.get as jest.Mock).mockReturnValue('localhost:3001');
  });

  describe('start', () => {
    it('throws when agentName is missing', () => {
      expect(() => controller.start('', mockUser as never, mockReq, mockRes)).toThrow(
        BadRequestException,
      );
    });

    it('throws when Google OAuth is not configured', () => {
      geminiAuth.isConfigured.mockReturnValue(false);
      expect(() => controller.start('my-agent', mockUser as never, mockReq, mockRes)).toThrow(
        'Google OAuth not configured',
      );
    });

    it('generates state, stores pending, and redirects to auth URL', () => {
      controller.start('my-agent', mockUser as never, mockReq, mockRes);

      expect(geminiAuth.generateState).toHaveBeenCalled();
      expect(geminiAuth.buildAuthUrl).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/routing/gemini-auth/callback',
        'test-state-123',
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2?state=test',
      );
    });

    it('sweeps expired states on each start call', () => {
      // Start creates a pending state
      controller.start('agent-1', mockUser as never, mockReq, mockRes);
      const pendingStates = (
        controller as unknown as { pendingStates: Map<string, { expiresAt: number }> }
      ).pendingStates;
      expect(pendingStates.size).toBe(1);

      // Expire it manually
      const entry = pendingStates.get('test-state-123')!;
      entry.expiresAt = Date.now() - 1000;

      // Next start should clean up the expired one and add a new one
      geminiAuth.generateState.mockReturnValue('new-state-456');
      controller.start('agent-2', mockUser as never, mockReq, mockRes);
      expect(pendingStates.has('test-state-123')).toBe(false);
      expect(pendingStates.has('new-state-456')).toBe(true);
      expect(pendingStates.size).toBe(1);
    });

    it('uses x-forwarded-proto and x-forwarded-host headers', () => {
      const reqWithProxy = {
        protocol: 'http',
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.example.com',
        },
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      controller.start('my-agent', mockUser as never, reqWithProxy, mockRes);

      expect(geminiAuth.buildAuthUrl).toHaveBeenCalledWith(
        'https://app.example.com/api/v1/routing/gemini-auth/callback',
        'test-state-123',
      );
    });
  });

  describe('callback', () => {
    it('returns 400 when code is missing', async () => {
      await controller.callback('', 'state', mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('Missing code or state parameter'),
      );
    });

    it('returns 400 when state is missing', async () => {
      await controller.callback('code', '', mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when state is not found in pending', async () => {
      await controller.callback('code', 'unknown-state', mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('OAuth state expired or invalid'),
      );
    });

    it('returns 400 when state has expired', async () => {
      // Start to create a pending state, then expire it
      controller.start('my-agent', mockUser as never, mockReq, mockRes);

      // Manually expire the state by accessing the pendingStates map
      const pendingStates = (
        controller as unknown as { pendingStates: Map<string, { expiresAt: number }> }
      ).pendingStates;
      const entry = pendingStates.get('test-state-123')!;
      entry.expiresAt = Date.now() - 1000; // expired

      await controller.callback('code', 'test-state-123', mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('expired or invalid'));
    });

    it('exchanges code and upserts provider on success', async () => {
      // Start to create pending state
      controller.start('my-agent', mockUser as never, mockReq, mockRes);
      jest.clearAllMocks();
      (mockReq.get as jest.Mock).mockReturnValue('localhost:3001');
      geminiAuth.exchangeCode.mockResolvedValue('refresh-token-abc');
      resolveAgentService.resolve.mockResolvedValue({
        id: 'agent-id-1',
        name: 'my-agent',
      } as never);
      routingService.upsertProvider.mockResolvedValue({ provider: {} as never, isNew: true });

      await controller.callback('auth-code', 'test-state-123', mockReq, mockRes);

      expect(geminiAuth.exchangeCode).toHaveBeenCalledWith(
        'auth-code',
        'http://localhost:3001/api/v1/routing/gemini-auth/callback',
      );
      expect(resolveAgentService.resolve).toHaveBeenCalledWith('user-1', 'my-agent');
      expect(routingService.upsertProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'user-1',
        'gemini',
        'refresh-token-abc',
        'subscription',
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('Gemini connected successfully'),
      );
    });

    it('returns success HTML with green color and postMessage', async () => {
      controller.start('my-agent', mockUser as never, mockReq, mockRes);
      jest.clearAllMocks();
      (mockReq.get as jest.Mock).mockReturnValue('localhost:3001');
      geminiAuth.exchangeCode.mockResolvedValue('rt');
      resolveAgentService.resolve.mockResolvedValue({ id: 'a1', name: 'ag' } as never);
      routingService.upsertProvider.mockResolvedValue({ provider: {} as never, isNew: true });

      await controller.callback('code', 'test-state-123', mockReq, mockRes);

      const html = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      expect(html).toContain('#16a34a');
      expect(html).toContain('success:true');
      expect(html).toContain('gemini-auth-done');
      expect(html).toContain('window.location.origin');
    });

    it('returns 500 when exchangeCode throws', async () => {
      controller.start('my-agent', mockUser as never, mockReq, mockRes);
      jest.clearAllMocks();
      (mockReq.get as jest.Mock).mockReturnValue('localhost:3001');
      geminiAuth.exchangeCode.mockRejectedValue(new Error('Exchange failed'));

      await controller.callback('code', 'test-state-123', mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('Failed to complete Google authentication'),
      );
    });

    it('returns error HTML with red color', async () => {
      controller.start('my-agent', mockUser as never, mockReq, mockRes);
      jest.clearAllMocks();
      (mockReq.get as jest.Mock).mockReturnValue('localhost:3001');
      geminiAuth.exchangeCode.mockRejectedValue(new Error('fail'));

      await controller.callback('code', 'test-state-123', mockReq, mockRes);

      const html = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      expect(html).toContain('#dc2626');
      expect(html).toContain('success:false');
    });

    it('handles non-Error thrown values', async () => {
      controller.start('my-agent', mockUser as never, mockReq, mockRes);
      jest.clearAllMocks();
      (mockReq.get as jest.Mock).mockReturnValue('localhost:3001');
      geminiAuth.exchangeCode.mockRejectedValue('string error');

      await controller.callback('code', 'test-state-123', mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('deletes pending state after use (replay protection)', async () => {
      controller.start('my-agent', mockUser as never, mockReq, mockRes);
      jest.clearAllMocks();
      (mockReq.get as jest.Mock).mockReturnValue('localhost:3001');
      geminiAuth.exchangeCode.mockResolvedValue('rt');
      resolveAgentService.resolve.mockResolvedValue({ id: 'a1', name: 'ag' } as never);
      routingService.upsertProvider.mockResolvedValue({ provider: {} as never, isNew: true });

      // First call succeeds
      await controller.callback('code', 'test-state-123', mockReq, mockRes);
      expect(mockRes.send).toHaveBeenCalled();

      // Second call with same state fails
      jest.clearAllMocks();
      (mockRes.status as jest.Mock).mockReturnThis();
      await controller.callback('code', 'test-state-123', mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('closePage', () => {
    it('returns HTML with the message', () => {
      const html = (
        controller as unknown as { closePage: (msg: string, s?: boolean) => string }
      ).closePage('Test message');
      expect(html).toContain('Test message');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('#dc2626'); // error red by default
    });

    it('returns green for success', () => {
      const html = (
        controller as unknown as { closePage: (msg: string, s?: boolean) => string }
      ).closePage('OK', true);
      expect(html).toContain('#16a34a');
      expect(html).toContain('success:true');
    });
  });
});
