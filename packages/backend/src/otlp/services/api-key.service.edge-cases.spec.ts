import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ApiKeyGeneratorService } from './api-key.service';
import { Tenant } from '../../entities/tenant.entity';
import { Agent } from '../../entities/agent.entity';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { AgentKeyAuthGuard } from '../guards/agent-key-auth.guard';

jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomBytes: jest.fn(),
  };
});

const TEST_SECRET = 'a'.repeat(32);
jest.mock('../../common/utils/crypto.util', () => {
  const actual = jest.requireActual('../../common/utils/crypto.util');
  return {
    ...actual,
    getEncryptionSecret: () => TEST_SECRET,
  };
});

import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

const mockedUuidv4 = uuidv4 as jest.Mock;
const mockedRandomBytes = randomBytes as jest.Mock;

describe('ApiKeyGeneratorService — edge cases', () => {
  let service: ApiKeyGeneratorService;
  let mockTenantFindOne: jest.Mock;
  let mockTenantInsert: jest.Mock;
  let mockAgentInsert: jest.Mock;
  let mockKeyInsert: jest.Mock;
  let mockKeyDelete: jest.Mock;
  let mockKeyGetOne: jest.Mock;
  let mockKeyQb: Record<string, jest.Mock>;
  let mockAgentGetOne: jest.Mock;
  let mockAgentQb: Record<string, jest.Mock>;
  let mockClearCache: jest.Mock;

  beforeEach(async () => {
    mockTenantFindOne = jest.fn();
    mockTenantInsert = jest.fn().mockResolvedValue({});
    mockAgentInsert = jest.fn().mockResolvedValue({});
    mockKeyInsert = jest.fn().mockResolvedValue({});
    mockKeyDelete = jest.fn().mockResolvedValue({});
    mockKeyGetOne = jest.fn();
    mockAgentGetOne = jest.fn();
    mockClearCache = jest.fn();

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
          useValue: { findOne: mockTenantFindOne, insert: mockTenantInsert },
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
            delete: mockKeyDelete,
            createQueryBuilder: jest.fn().mockReturnValue(mockKeyQb),
          },
        },
        {
          provide: AgentKeyAuthGuard,
          useValue: { clearCache: mockClearCache },
        },
      ],
    }).compile();

    service = module.get<ApiKeyGeneratorService>(ApiKeyGeneratorService);

    mockedUuidv4.mockReset();
    mockedRandomBytes.mockReset();
    mockedRandomBytes.mockReturnValue(Buffer.from('a'.repeat(32), 'utf8'));
    mockedUuidv4
      .mockReturnValueOnce('uuid-tenant-1')
      .mockReturnValueOnce('uuid-agent-1')
      .mockReturnValueOnce('uuid-key-1');
  });

  // ──────────────────────────────────────────────
  // onboardAgent — duplicate / constraint violations
  // ──────────────────────────────────────────────

  describe('onboardAgent duplicates and constraints', () => {
    const defaultParams = { tenantName: 'user-42', agentName: 'my-agent' };

    it('should propagate unique constraint violation when same agent name re-onboarded', async () => {
      mockTenantFindOne.mockResolvedValue({
        id: 'existing-tenant-id',
        name: 'user-42',
      });
      const constraintError = new Error('duplicate key value violates unique constraint');
      constraintError.name = 'QueryFailedError';
      mockAgentInsert.mockRejectedValueOnce(constraintError);

      await expect(service.onboardAgent(defaultParams)).rejects.toThrow(
        'duplicate key value violates unique constraint',
      );
    });

    it('should not insert API key when agent insert fails with unique constraint', async () => {
      mockTenantFindOne.mockResolvedValue({
        id: 'existing-tenant-id',
        name: 'user-42',
      });
      mockAgentInsert.mockRejectedValueOnce(new Error('duplicate key'));

      await expect(service.onboardAgent(defaultParams)).rejects.toThrow();
      expect(mockKeyInsert).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // onboardAgent — agentCategory + agentPlatform
  // ──────────────────────────────────────────────

  describe('onboardAgent optional category and platform', () => {
    const defaultParams = { tenantName: 'user-42', agentName: 'my-agent' };

    it('should store agentCategory and agentPlatform when provided', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent({
        ...defaultParams,
        agentCategory: 'coding',
        agentPlatform: 'openclaw',
      });

      expect(mockAgentInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_category: 'coding',
          agent_platform: 'openclaw',
        }),
      );
    });

    it('should default agent_category to null when omitted', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      expect(mockAgentInsert).toHaveBeenCalledWith(
        expect.objectContaining({ agent_category: null }),
      );
    });

    it('should default agent_platform to null when omitted', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent(defaultParams);

      expect(mockAgentInsert).toHaveBeenCalledWith(
        expect.objectContaining({ agent_platform: null }),
      );
    });
  });

  // ──────────────────────────────────────────────
  // getKeyForAgent — soft-delete filter + cross-tenant
  // ──────────────────────────────────────────────

  describe('getKeyForAgent isolation and soft-delete', () => {
    it('should apply deleted_at IS NULL filter (soft-delete)', async () => {
      mockKeyGetOne.mockResolvedValue({ key_prefix: 'mnfst_xxx' });

      await service.getKeyForAgent('user-99', 'bot-x');

      expect(mockKeyQb.andWhere).toHaveBeenCalledWith('a.deleted_at IS NULL');
    });

    it('should throw NotFoundException when wrong userId for valid agent (cross-tenant)', async () => {
      // Wrong userId for an agent that exists under a different tenant — the
      // join on t.name forces a null result, never a leak.
      mockKeyGetOne.mockResolvedValue(null);

      await expect(service.getKeyForAgent('attacker-user', 'agent-a')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockKeyQb.where).toHaveBeenCalledWith('t.name = :userId', {
        userId: 'attacker-user',
      });
    });
  });

  // ──────────────────────────────────────────────
  // rotateKey — soft-delete + cross-tenant
  // ──────────────────────────────────────────────

  describe('rotateKey isolation and soft-delete', () => {
    it('should apply deleted_at IS NULL filter when looking up agent', async () => {
      mockAgentGetOne.mockResolvedValue({
        id: 'agent-id-1',
        name: 'my-agent',
        tenant_id: 'tenant-id-1',
      });

      await service.rotateKey('user-1', 'my-agent');

      expect(mockAgentQb.andWhere).toHaveBeenCalledWith('a.deleted_at IS NULL');
    });

    it('should throw NotFoundException when cross-tenant userId does not own the agent', async () => {
      // Wrong user trying to rotate someone else's agent — query returns null.
      mockAgentGetOne.mockResolvedValue(null);

      await expect(service.rotateKey('attacker-user', 'someone-elses-agent')).rejects.toThrow(
        NotFoundException,
      );
      // Ensure we never deleted the key for an agent we couldn't look up.
      expect(mockKeyDelete).not.toHaveBeenCalled();
      expect(mockClearCache).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // onboardAgent + rotateKey — empty / whitespace inputs
  // ──────────────────────────────────────────────

  describe('input edge cases (empty strings)', () => {
    it('should still call tenant lookup when tenantName is an empty string', async () => {
      // Service does not validate empty strings — DTO does. Pins current
      // behaviour so a silent regression inside the service is caught.
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent({ tenantName: '', agentName: 'my-agent' });

      expect(mockTenantFindOne).toHaveBeenCalledWith({ where: { name: '' } });
      expect(mockTenantInsert).toHaveBeenCalledWith(expect.objectContaining({ name: '' }));
    });

    it('should pass empty agentName through to agent insert', async () => {
      mockTenantFindOne.mockResolvedValue(null);

      await service.onboardAgent({ tenantName: 'user-42', agentName: '' });

      expect(mockAgentInsert).toHaveBeenCalledWith(expect.objectContaining({ name: '' }));
      // Label still concatenates even for empty agent name.
      expect(mockKeyInsert).toHaveBeenCalledWith(expect.objectContaining({ label: ' ingest key' }));
    });

    it('rotateKey should throw NotFoundException when called with empty agentName', async () => {
      mockAgentGetOne.mockResolvedValue(null);

      await expect(service.rotateKey('user-1', '')).rejects.toThrow(NotFoundException);
      expect(mockAgentQb.where).toHaveBeenCalledWith('a.name = :agentName', {
        agentName: '',
      });
    });

    it('rotateKey should throw NotFoundException when called with empty userId', async () => {
      mockAgentGetOne.mockResolvedValue(null);

      await expect(service.rotateKey('', 'my-agent')).rejects.toThrow(NotFoundException);
      expect(mockAgentQb.andWhere).toHaveBeenCalledWith('t.name = :userId', {
        userId: '',
      });
    });
  });
});
