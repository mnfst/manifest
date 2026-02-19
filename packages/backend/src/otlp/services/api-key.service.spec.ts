import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ApiKeyGeneratorService } from './api-key.service';
import { Tenant } from '../../entities/tenant.entity';
import { Agent } from '../../entities/agent.entity';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { sha256, keyPrefix } from '../../common/utils/hash.util';

jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomBytes: jest.fn(),
  };
});

import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

const mockedUuidv4 = uuidv4 as jest.Mock;
const mockedRandomBytes = randomBytes as jest.Mock;

describe('ApiKeyGeneratorService', () => {
  let service: ApiKeyGeneratorService;
  let mockTenantFindOne: jest.Mock;
  let mockTenantInsert: jest.Mock;
  let mockAgentInsert: jest.Mock;
  let mockKeyInsert: jest.Mock;
  let mockKeyUpdate: jest.Mock;
  let mockKeyGetOne: jest.Mock;
  let mockKeyQb: Record<string, jest.Mock>;
  let mockAgentGetOne: jest.Mock;
  let mockAgentQb: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockTenantFindOne = jest.fn();
    mockTenantInsert = jest.fn().mockResolvedValue({});
    mockAgentInsert = jest.fn().mockResolvedValue({});
    mockKeyInsert = jest.fn().mockResolvedValue({});
    mockKeyUpdate = jest.fn().mockResolvedValue({});
    mockKeyGetOne = jest.fn();
    mockAgentGetOne = jest.fn();

    mockKeyQb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: mockKeyGetOne,
    };

    mockAgentQb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: mockAgentGetOne,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGeneratorService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            findOne: mockTenantFindOne,
            insert: mockTenantInsert,
          },
        },
        {
          provide: getRepositoryToken(Agent),
          useValue: {
            insert: mockAgentInsert,
            createQueryBuilder: jest.fn().mockReturnValue(mockAgentQb),
          },
        },
        {
          provide: getRepositoryToken(AgentApiKey),
          useValue: {
            insert: mockKeyInsert,
            update: mockKeyUpdate,
            createQueryBuilder: jest.fn().mockReturnValue(mockKeyQb),
          },
        },
      ],
    }).compile();

    service = module.get<ApiKeyGeneratorService>(ApiKeyGeneratorService);

    // Reset module-level mocks before configuring
    mockedUuidv4.mockReset();
    mockedRandomBytes.mockReset();

    // Default: randomBytes returns a deterministic buffer
    mockedRandomBytes.mockReturnValue(
      Buffer.from('a'.repeat(32), 'utf8'),
    );
    // Default: sequential UUIDs for the new-tenant path
    // Order: tenantId, agentId, keyId
    mockedUuidv4
      .mockReturnValueOnce('uuid-tenant-1')
      .mockReturnValueOnce('uuid-agent-1')
      .mockReturnValueOnce('uuid-key-1');
  });

  // ──────────────────────────────────────────────
  // onboardAgent
  // ──────────────────────────────────────────────

  describe('onboardAgent', () => {
    const defaultParams = {
      tenantName: 'user-42',
      agentName: 'my-agent',
    };

    it('should create a new tenant when none exists', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      expect(mockTenantFindOne).toHaveBeenCalledWith({
        where: { name: 'user-42' },
      });
      expect(mockTenantInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uuid-tenant-1',
          name: 'user-42',
          is_active: true,
        }),
      );
    });

    it('should reuse existing tenant when one exists', async () => {
      mockTenantFindOne.mockResolvedValue({
        id: 'existing-tenant-id',
        name: 'user-42',
      });

      const result = await service.onboardAgent(defaultParams);

      expect(mockTenantInsert).not.toHaveBeenCalled();
      expect(result.tenantId).toBe('existing-tenant-id');
    });

    it('should create an agent linked to the tenant', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      expect(mockAgentInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uuid-agent-1',
          name: 'my-agent',
          is_active: true,
          tenant_id: 'uuid-tenant-1',
        }),
      );
    });

    it('should store key_hash and key_prefix, not the raw key', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      const insertCall = mockKeyInsert.mock.calls[0][0];
      const expectedRawKey =
        'mnfst_' + Buffer.from('a'.repeat(32), 'utf8').toString('base64url');

      expect(insertCall.key).toBeNull();
      expect(insertCall.key_hash).toBe(sha256(expectedRawKey));
      expect(insertCall.key_prefix).toBe(keyPrefix(expectedRawKey));
    });

    it('should set the key label from agent name', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      expect(mockKeyInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'my-agent ingest key',
        }),
      );
    });

    it('should return tenantId, agentId, and the raw apiKey', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      const result = await service.onboardAgent(defaultParams);

      expect(result.tenantId).toBe('uuid-tenant-1');
      expect(result.agentId).toBe('uuid-agent-1');
      expect(result.apiKey).toMatch(/^mnfst_/);
    });

    it('should pass optional organization and email when creating tenant', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent({
        ...defaultParams,
        organizationName: 'Acme Corp',
        email: 'admin@acme.com',
      });

      expect(mockTenantInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_name: 'Acme Corp',
          email: 'admin@acme.com',
        }),
      );
    });

    it('should default organization_name and email to null', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      expect(mockTenantInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_name: null,
          email: null,
        }),
      );
    });

    it('should default agent description to null when omitted', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      expect(mockAgentInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
        }),
      );
    });

    it('should pass agent description when provided', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent({
        ...defaultParams,
        agentDescription: 'A helpful bot',
      });

      expect(mockAgentInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'A helpful bot',
        }),
      );
    });

    it('should mark the new key as active', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      expect(mockKeyInsert).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true }),
      );
    });

    it('should generate a key starting with mnfst_ prefix', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      const result = await service.onboardAgent(defaultParams);

      expect(result.apiKey).toMatch(/^mnfst_/);
      expect(result.apiKey.length).toBeGreaterThan(4);
    });

    it('should use tenant id from existing tenant for agent and key', async () => {
      mockTenantFindOne.mockResolvedValue({
        id: 'pre-existing-tenant',
        name: 'user-42',
      });

      await service.onboardAgent(defaultParams);

      expect(mockAgentInsert).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 'pre-existing-tenant' }),
      );
      expect(mockKeyInsert).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 'pre-existing-tenant' }),
      );
    });
  });

  // ──────────────────────────────────────────────
  // getKeyForAgent
  // ──────────────────────────────────────────────

  describe('getKeyForAgent', () => {
    it('should return keyPrefix when an active key exists', async () => {
      mockKeyGetOne.mockResolvedValue({
        key_prefix: 'mnfst_abc12345',
        key_hash: 'somehash',
      });

      const result = await service.getKeyForAgent('user-1', 'agent-a');

      expect(result).toEqual({ keyPrefix: 'mnfst_abc12345' });
    });

    it('should throw NotFoundException when no active key is found', async () => {
      mockKeyGetOne.mockResolvedValue(null);

      await expect(
        service.getKeyForAgent('user-1', 'agent-a'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getKeyForAgent('user-1', 'agent-a'),
      ).rejects.toThrow('No active API key found for this agent');
    });

    it('should query by userId and agentName with is_active filter', async () => {
      mockKeyGetOne.mockResolvedValue({ key_prefix: 'mnfst_xxx' });

      await service.getKeyForAgent('user-99', 'bot-x');

      expect(mockKeyQb.leftJoin).toHaveBeenCalledWith('k.agent', 'a');
      expect(mockKeyQb.leftJoin).toHaveBeenCalledWith('a.tenant', 't');
      expect(mockKeyQb.where).toHaveBeenCalledWith('t.name = :userId', {
        userId: 'user-99',
      });
      expect(mockKeyQb.andWhere).toHaveBeenCalledWith(
        'a.name = :agentName',
        { agentName: 'bot-x' },
      );
      expect(mockKeyQb.andWhere).toHaveBeenCalledWith('k.is_active = true');
    });

    it('should not return the raw key or key_hash', async () => {
      mockKeyGetOne.mockResolvedValue({
        key_prefix: 'mnfst_partial__',
        key_hash: 'secret-hash',
        key: 'should-not-appear',
      });

      const result = await service.getKeyForAgent('user-1', 'agent-a');

      expect(result).toEqual({ keyPrefix: 'mnfst_partial__' });
      expect(result).not.toHaveProperty('key');
      expect(result).not.toHaveProperty('key_hash');
    });
  });

  // ──────────────────────────────────────────────
  // rotateKey
  // ──────────────────────────────────────────────

  describe('rotateKey', () => {
    const existingAgent = {
      id: 'agent-id-1',
      name: 'my-agent',
      tenant_id: 'tenant-id-1',
    };

    it('should throw NotFoundException when agent is not found', async () => {
      mockAgentGetOne.mockResolvedValue(null);

      await expect(
        service.rotateKey('user-1', 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.rotateKey('user-1', 'nonexistent-agent'),
      ).rejects.toThrow('Agent not found or access denied');
    });

    it('should deactivate all existing active keys for the agent', async () => {
      mockAgentGetOne.mockResolvedValue(existingAgent);

      await service.rotateKey('user-1', 'my-agent');

      expect(mockKeyUpdate).toHaveBeenCalledWith(
        { agent_id: 'agent-id-1', is_active: true },
        { is_active: false },
      );
    });

    it('should create a new key with hash and prefix, no plaintext', async () => {
      mockAgentGetOne.mockResolvedValue(existingAgent);

      await service.rotateKey('user-1', 'my-agent');

      const insertCall = mockKeyInsert.mock.calls[0][0];
      const expectedRawKey =
        'mnfst_' + Buffer.from('a'.repeat(32), 'utf8').toString('base64url');

      expect(insertCall.key).toBeNull();
      expect(insertCall.key_hash).toBe(sha256(expectedRawKey));
      expect(insertCall.key_prefix).toBe(keyPrefix(expectedRawKey));
      expect(insertCall.is_active).toBe(true);
      expect(insertCall.tenant_id).toBe('tenant-id-1');
      expect(insertCall.agent_id).toBe('agent-id-1');
    });

    it('should label the rotated key with "(rotated)" suffix', async () => {
      mockAgentGetOne.mockResolvedValue(existingAgent);

      await service.rotateKey('user-1', 'my-agent');

      expect(mockKeyInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'my-agent ingest key (rotated)',
        }),
      );
    });

    it('should return the new raw apiKey', async () => {
      mockAgentGetOne.mockResolvedValue(existingAgent);

      const result = await service.rotateKey('user-1', 'my-agent');

      expect(result.apiKey).toMatch(/^mnfst_/);
      expect(result.apiKey.length).toBeGreaterThan(4);
    });

    it('should look up agent by name and userId via query builder', async () => {
      mockAgentGetOne.mockResolvedValue(existingAgent);

      await service.rotateKey('user-7', 'bot-z');

      expect(mockAgentQb.leftJoin).toHaveBeenCalledWith('a.tenant', 't');
      expect(mockAgentQb.where).toHaveBeenCalledWith(
        'a.name = :agentName',
        { agentName: 'bot-z' },
      );
      expect(mockAgentQb.andWhere).toHaveBeenCalledWith(
        't.name = :userId',
        { userId: 'user-7' },
      );
    });

    it('should deactivate old keys before inserting the new one', async () => {
      mockAgentGetOne.mockResolvedValue(existingAgent);

      const callOrder: string[] = [];
      mockKeyUpdate.mockImplementation(() => {
        callOrder.push('update');
        return Promise.resolve({});
      });
      mockKeyInsert.mockImplementation(() => {
        callOrder.push('insert');
        return Promise.resolve({});
      });

      await service.rotateKey('user-1', 'my-agent');

      expect(callOrder).toEqual(['update', 'insert']);
    });
  });
});
