import { CopilotController } from './copilot.controller';
import { ProviderService } from '../../routing-core/provider.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { CopilotDeviceAuthService } from './copilot-device-auth.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { Agent } from '../../../entities/agent.entity';

const mockCtx = { tenantId: 'tenant-1', userId: 'user-1' } as never;
const mockAgentName = { agentName: 'test-agent' } as never;
const TEST_AGENT_ID = 'agent-001';
const TEST_TENANT_ID = 'tenant-1';

describe('CopilotController', () => {
  let controller: CopilotController;
  let mockProviderService: Record<string, jest.Mock>;
  let mockResolveAgent: Record<string, jest.Mock>;
  let mockCopilotAuth: Record<string, jest.Mock>;
  let mockDiscoveryService: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProviderService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: false }),
      nextOAuthLabel: jest.fn().mockResolvedValue(undefined),
      recalculateTiers: jest.fn().mockResolvedValue(undefined),
      recalculateTiersForUser: jest.fn().mockResolvedValue(undefined),
    };
    mockResolveAgent = {
      resolve: jest.fn().mockResolvedValue({
        id: TEST_AGENT_ID,
        name: 'test-agent',
        tenant_id: TEST_TENANT_ID,
      } as Agent),
    };
    mockCopilotAuth = {
      requestDeviceCode: jest.fn(),
      pollForToken: jest.fn(),
    };
    mockDiscoveryService = {
      discoverModels: jest.fn().mockResolvedValue([]),
    };

    controller = new CopilotController(
      mockProviderService as unknown as ProviderService,
      mockResolveAgent as unknown as ResolveAgentService,
      mockCopilotAuth as unknown as CopilotDeviceAuthService,
      mockDiscoveryService as unknown as ModelDiscoveryService,
    );
  });

  /* ── copilot device login ── */

  describe('copilotDeviceCode', () => {
    it('should request a device code from copilot auth service', async () => {
      const deviceCodeResponse = {
        device_code: 'dc_abc',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      };
      mockCopilotAuth.requestDeviceCode.mockResolvedValue(deviceCodeResponse);

      const result = await controller.copilotDeviceCode(mockCtx, mockAgentName);

      expect(mockResolveAgent.resolve).toHaveBeenCalledWith(TEST_TENANT_ID, 'test-agent');
      expect(result).toEqual(deviceCodeResponse);
    });
  });

  describe('copilotPollToken', () => {
    it('should store token and return complete when poll succeeds', async () => {
      mockCopilotAuth.pollForToken.mockResolvedValue({
        status: 'complete',
        token: 'ghu_github_token',
      });

      const result = await controller.copilotPollToken(mockCtx, mockAgentName, {
        deviceCode: 'dc_abc',
      } as never);

      expect(result).toEqual({ status: 'complete' });
      expect(mockProviderService.upsertProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        TEST_TENANT_ID,
        'copilot',
        'ghu_github_token',
        'subscription',
        undefined,
        undefined,
        'user-1',
      );
    });

    it('stores a second token under the next OAuth label', async () => {
      mockProviderService.nextOAuthLabel.mockResolvedValue('Key 2');
      mockCopilotAuth.pollForToken.mockResolvedValue({
        status: 'complete',
        token: 'ghu_second_token',
      });

      await controller.copilotPollToken(mockCtx, mockAgentName, {
        deviceCode: 'dc_abc',
      } as never);

      expect(mockProviderService.nextOAuthLabel).toHaveBeenCalledWith(TEST_TENANT_ID, 'copilot');
      expect(mockProviderService.upsertProvider).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        TEST_TENANT_ID,
        'copilot',
        'ghu_second_token',
        'subscription',
        undefined,
        'Key 2',
        'user-1',
      );
    });

    it('discovers models without routing agents when the copilot provider is new', async () => {
      const providerRecord = { id: 'p1', provider: 'copilot', is_active: true };
      mockCopilotAuth.pollForToken.mockResolvedValue({
        status: 'complete',
        token: 'ghu_token',
      });
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: providerRecord,
        isNew: true,
      });

      await controller.copilotPollToken(mockCtx, mockAgentName, {
        deviceCode: 'dc_abc',
      } as never);

      expect(mockDiscoveryService.discoverModels).toHaveBeenCalledWith(providerRecord);
      expect(mockProviderService.recalculateTiersForUser).not.toHaveBeenCalled();
      expect(mockProviderService.recalculateTiers).not.toHaveBeenCalled();
    });

    it('discovers models without routing agents on an existing-row copilot reconnect', async () => {
      const providerRecord = { id: 'p1', provider: 'copilot', is_active: true };
      mockCopilotAuth.pollForToken.mockResolvedValue({
        status: 'complete',
        token: 'ghu_token',
      });
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: providerRecord,
        isNew: false,
      });

      await controller.copilotPollToken(mockCtx, mockAgentName, {
        deviceCode: 'dc_abc',
      } as never);

      expect(mockDiscoveryService.discoverModels).toHaveBeenCalledWith(providerRecord);
      expect(mockProviderService.recalculateTiers).not.toHaveBeenCalled();
      expect(mockProviderService.recalculateTiersForUser).not.toHaveBeenCalled();
    });

    it('should swallow discovery errors in copilotPollToken', async () => {
      const providerRecord = { id: 'p1', provider: 'copilot', is_active: true };
      mockCopilotAuth.pollForToken.mockResolvedValue({
        status: 'complete',
        token: 'ghu_token',
      });
      mockProviderService.upsertProvider.mockResolvedValue({
        provider: providerRecord,
        isNew: true,
      });
      mockDiscoveryService.discoverModels.mockRejectedValue(new Error('discovery failed'));

      const result = await controller.copilotPollToken(mockCtx, mockAgentName, {
        deviceCode: 'dc_abc',
      } as never);

      expect(result).toEqual({ status: 'complete' });
    });

    it('should return pending without storing when still waiting', async () => {
      mockCopilotAuth.pollForToken.mockResolvedValue({ status: 'pending' });

      const result = await controller.copilotPollToken(mockCtx, mockAgentName, {
        deviceCode: 'dc_abc',
      } as never);

      expect(result).toEqual({ status: 'pending' });
      expect(mockProviderService.upsertProvider).not.toHaveBeenCalled();
    });

    it('should return expired without storing', async () => {
      mockCopilotAuth.pollForToken.mockResolvedValue({ status: 'expired' });

      const result = await controller.copilotPollToken(mockCtx, mockAgentName, {
        deviceCode: 'dc_abc',
      } as never);

      expect(result).toEqual({ status: 'expired' });
      expect(mockProviderService.upsertProvider).not.toHaveBeenCalled();
    });
  });
});
