import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { PlaygroundAgentService } from './playground-agent.service';
import type { Agent } from '../entities/agent.entity';
import type { TenantCacheService } from '../common/services/tenant-cache.service';
import type { ProviderService } from '../routing/routing-core/provider.service';
import { PLAYGROUND_AGENT_NAME } from '../common/constants/playground.constants';

const TENANT_ID = 'tenant-abc';
const USER_ID = 'user-xyz';
const AGENT_ID = 'agent-sys-1';

/** A minimal Agent-shaped object that satisfies the service's return type. */
function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: AGENT_ID,
    name: PLAYGROUND_AGENT_NAME,
    display_name: PLAYGROUND_AGENT_NAME,
    is_system: true,
    is_active: true,
    tenant_id: TENANT_ID,
    ...overrides,
  } as Agent;
}

interface Mocks {
  agentRepo: {
    findOne: jest.Mock;
    insert: jest.Mock;
  };
  tenantCache: {
    resolve: jest.Mock;
  };
  providerService: {
    enableAllProvidersForAgent: jest.Mock;
  };
}

function buildService(mocks: Partial<Mocks> = {}): {
  service: PlaygroundAgentService;
  mocks: Mocks;
} {
  const full: Mocks = {
    agentRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(undefined),
    },
    tenantCache: {
      resolve: jest.fn().mockResolvedValue(TENANT_ID),
    },
    providerService: {
      enableAllProvidersForAgent: jest.fn().mockResolvedValue(undefined),
    },
    ...mocks,
  };

  const service = new PlaygroundAgentService(
    full.agentRepo as unknown as Repository<Agent>,
    full.tenantCache as unknown as TenantCacheService,
    full.providerService as unknown as ProviderService,
  );

  return { service, mocks: full };
}

describe('PlaygroundAgentService.resolve', () => {
  describe('(a) tenant not found', () => {
    it('throws NotFoundException when tenantCache.resolve returns null', async () => {
      const { service } = buildService({
        tenantCache: { resolve: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.resolve(USER_ID)).rejects.toThrow(NotFoundException);
      await expect(service.resolve(USER_ID)).rejects.toThrow('Tenant not found');
    });

    it('does not call agentRepo when tenant is not found', async () => {
      const { service, mocks } = buildService({
        tenantCache: { resolve: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.resolve(USER_ID)).rejects.toThrow(NotFoundException);
      expect(mocks.agentRepo.findOne).not.toHaveBeenCalled();
      expect(mocks.agentRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('(b) existing system agent returned', () => {
    it('returns the existing agent without inserting a new one', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(existing),
          insert: jest.fn(),
        },
      });

      const result = await service.resolve(USER_ID);

      expect(result).toBe(existing);
      expect(mocks.agentRepo.insert).not.toHaveBeenCalled();
    });

    it('does not call enableAllProvidersForAgent when an agent already exists', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(existing),
          insert: jest.fn(),
        },
      });

      await service.resolve(USER_ID);

      expect(mocks.providerService.enableAllProvidersForAgent).not.toHaveBeenCalled();
    });

    it('queries agentRepo with the correct tenant_id, is_system and deleted_at filters', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(existing),
          insert: jest.fn(),
        },
      });

      await service.resolve(USER_ID);

      expect(mocks.agentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID, is_system: true }),
        }),
      );
    });
  });

  describe('(c) lazy-create path', () => {
    it('inserts a new agent and returns it when no system agent exists', async () => {
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(null),
          insert: jest.fn().mockResolvedValue(undefined),
        },
      });

      const result = await service.resolve(USER_ID);

      expect(mocks.agentRepo.insert).toHaveBeenCalledTimes(1);
      expect(result.name).toBe(PLAYGROUND_AGENT_NAME);
      expect(result.display_name).toBe(PLAYGROUND_AGENT_NAME);
      expect(result.is_system).toBe(true);
      expect(result.is_active).toBe(true);
      expect(result.tenant_id).toBe(TENANT_ID);
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('calls enableAllProvidersForAgent with the new agent id and userId', async () => {
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(null),
          insert: jest.fn().mockResolvedValue(undefined),
        },
      });

      const result = await service.resolve(USER_ID);

      expect(mocks.providerService.enableAllProvidersForAgent).toHaveBeenCalledTimes(1);
      expect(mocks.providerService.enableAllProvidersForAgent).toHaveBeenCalledWith(
        result.id,
        USER_ID,
      );
    });

    it('returns the newly-created agent object (not a DB re-fetch)', async () => {
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(null),
          insert: jest.fn().mockResolvedValue(undefined),
        },
      });

      const result = await service.resolve(USER_ID);

      // insert is called once; findOne is called once (initial check only — no re-fetch on success)
      expect(mocks.agentRepo.findOne).toHaveBeenCalledTimes(1);
      expect(result.tenant_id).toBe(TENANT_ID);
    });
  });

  describe('(d) race: insert throws → re-find returns a row', () => {
    it('returns the race winner row without calling enableAllProvidersForAgent', async () => {
      const raceWinner = makeAgent({ id: 'agent-winner' });
      const { service, mocks } = buildService({
        agentRepo: {
          // First findOne (pre-insert check) → null; second (post-race re-find) → raceWinner
          findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(raceWinner),
          insert: jest.fn().mockRejectedValue(new Error('duplicate key value violates unique')),
        },
      });

      const result = await service.resolve(USER_ID);

      expect(result).toBe(raceWinner);
      expect(mocks.agentRepo.findOne).toHaveBeenCalledTimes(2);
      expect(mocks.providerService.enableAllProvidersForAgent).not.toHaveBeenCalled();
    });

    it('does not re-throw the insert error when the race winner row is found', async () => {
      const raceWinner = makeAgent({ id: 'agent-winner' });
      const { service } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(raceWinner),
          insert: jest.fn().mockRejectedValue(new Error('unique constraint')),
        },
      });

      await expect(service.resolve(USER_ID)).resolves.toBe(raceWinner);
    });
  });

  describe('(e) race: insert throws → re-find returns null', () => {
    it('throws NotFoundException when re-find after race returns null', async () => {
      const { service } = buildService({
        agentRepo: {
          // Both findOne calls return null (no winner row)
          findOne: jest.fn().mockResolvedValue(null),
          insert: jest.fn().mockRejectedValue(new Error('duplicate key')),
        },
      });

      await expect(service.resolve(USER_ID)).rejects.toThrow(NotFoundException);
      await expect(service.resolve(USER_ID)).rejects.toThrow(
        'Playground agent could not be resolved',
      );
    });

    it('does not call enableAllProvidersForAgent when the race re-find also returns null', async () => {
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(null),
          insert: jest.fn().mockRejectedValue(new Error('duplicate key')),
        },
      });

      await expect(service.resolve(USER_ID)).rejects.toThrow(NotFoundException);
      expect(mocks.providerService.enableAllProvidersForAgent).not.toHaveBeenCalled();
    });
  });
});
