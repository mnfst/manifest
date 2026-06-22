import { HttpException, HttpStatus } from '@nestjs/common';
import { KiroOauthController } from './kiro-oauth.controller';
import { KiroOauthService } from './kiro-oauth.service';
import { KiroAuthorizationOptionsError } from './kiro-oidc';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';

describe('KiroOauthController', () => {
  let controller: KiroOauthController;
  let oauthService: jest.Mocked<KiroOauthService>;
  let resolveAgent: jest.Mocked<ResolveAgentService>;
  let providerService: jest.Mocked<ProviderService>;

  beforeEach(() => {
    oauthService = {
      startAuthorization: jest.fn(),
      pollAuthorization: jest.fn(),
    } as unknown as jest.Mocked<KiroOauthService>;

    resolveAgent = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveAgentService>;

    providerService = {
      removeProvider: jest.fn(),
    } as unknown as jest.Mocked<ProviderService>;

    controller = new KiroOauthController(oauthService, resolveAgent, providerService);
  });

  describe('start', () => {
    it('starts the device flow for the resolved agent', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      oauthService.startAuthorization.mockResolvedValue({
        flowId: 'flow-1',
        userCode: 'AAAA-BBBB',
        verificationUri: 'https://verify',
        expiresAt: 123,
        pollIntervalMs: 5000,
      });

      const result = await controller.start('my-agent', {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never);

      expect(resolveAgent.resolve).toHaveBeenCalledWith('tenant-1', 'my-agent');
      expect(oauthService.startAuthorization).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'user-1',
        {},
      );
      expect(result.flowId).toBe('flow-1');
    });

    it('passes optional IAM Identity Center options to the device flow', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      oauthService.startAuthorization.mockResolvedValue({
        flowId: 'flow-1',
        userCode: 'AAAA-BBBB',
        verificationUri: 'https://verify',
        expiresAt: 123,
        pollIntervalMs: 5000,
      });

      await controller.start(
        'my-agent',
        { tenantId: 'tenant-1', userId: 'user-1' } as never,
        ' https://org.awsapps.com/start ',
        ' eu-west-1 ',
      );

      expect(oauthService.startAuthorization).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'user-1',
        {
          startUrl: 'https://org.awsapps.com/start',
          region: 'eu-west-1',
        },
      );
    });

    it('throws 400 when agentName is missing', async () => {
      await expect(
        controller.start('', { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('maps start failures to 503', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      oauthService.startAuthorization.mockRejectedValue(new Error('Failed to start Kiro login'));
      await expect(
        controller.start('my-agent', { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toMatchObject({
        message: 'Failed to start Kiro login',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('maps invalid IAM Identity Center options to 400', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      oauthService.startAuthorization.mockRejectedValue(
        new KiroAuthorizationOptionsError('bad Kiro option'),
      );
      await expect(controller.start('my-agent', { id: 'user-1' } as never)).rejects.toMatchObject({
        message: 'bad Kiro option',
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('maps non-Error start failures to a 503 with a default message', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      oauthService.startAuthorization.mockRejectedValue('boom');
      await expect(
        controller.start('my-agent', { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toMatchObject({
        message: 'Failed to start Kiro login',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });

  describe('poll', () => {
    it('polls by flowId for the current tenant', async () => {
      oauthService.pollAuthorization.mockResolvedValue({ status: 'pending' });
      const result = await controller.poll('flow-1', {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never);
      expect(oauthService.pollAuthorization).toHaveBeenCalledWith('flow-1', 'tenant-1');
      expect(result.status).toBe('pending');
    });

    it('throws 400 when flowId is missing', async () => {
      await expect(
        controller.poll('', { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('maps poll failures to 503', async () => {
      oauthService.pollAuthorization.mockRejectedValue(new Error('kaboom'));
      await expect(
        controller.poll('flow-1', { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toMatchObject({
        message: 'kaboom',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('maps non-Error poll failures to a default 503 message', async () => {
      oauthService.pollAuthorization.mockRejectedValue('nope');
      await expect(
        controller.poll('flow-1', { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toMatchObject({
        message: 'Failed to poll Kiro login',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });

  describe('revoke', () => {
    it('removes the kiro subscription provider for the resolved agent', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      providerService.removeProvider.mockResolvedValue({ notifications: ['gone'] } as never);

      const result = await controller.revoke('my-agent', 'Kiro 1', {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never);

      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'kiro',
        'subscription',
        'Kiro 1',
      );
      expect(result).toEqual({ ok: true, notifications: ['gone'] });
    });

    it('throws 400 when agentName is missing', async () => {
      await expect(
        controller.revoke('', undefined, { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toThrow(HttpException);
    });
  });
});
