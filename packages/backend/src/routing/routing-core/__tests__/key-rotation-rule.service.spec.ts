import { BadRequestException } from '@nestjs/common';
import { AgentKeyRotationRule } from '../../../entities/agent-key-rotation-rule.entity';
import { KeyRotationRuleService } from '../key-rotation-rule.service';
import { RoutingCacheService } from '../routing-cache.service';

/**
 * KeyRotationRuleService: agent-scoped key rotation rules.
 *
 * - Reads go through the per-agent routing cache (list/getRule).
 * - `replace` is a full replace keyed by the unique (agent_id, model) index:
 *   upsert + delete diff, then cache invalidation.
 * - Validation: provider inferred from the model name when omitted (and
 *   required when inference fails), keyOrder non-empty with distinct labels.
 *   Label/connection validation is deliberately lenient (see service).
 */

describe('KeyRotationRuleService', () => {
  let service: KeyRotationRuleService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let qbExecute: jest.Mock;
  let qbChain: Record<string, jest.Mock>;
  let cache: {
    getKeyRotationRules: jest.Mock;
    setKeyRotationRules: jest.Mock;
    invalidateKeyRotationRules: jest.Mock;
  };

  beforeEach(async () => {
    // QueryBuilder mock for the atomic INSERT … ON CONFLICT path and the
    // NOT IN delete path. Every link returns the same object so fluent chains
    // can be built with any shape.
    qbExecute = jest.fn().mockResolvedValue(undefined);
    qbChain = {};
    qbChain.insert = jest.fn(() => qbChain);
    qbChain.into = jest.fn(() => qbChain);
    qbChain.values = jest.fn(() => qbChain);
    qbChain.orUpdate = jest.fn(() => qbChain);
    qbChain.setParameter = jest.fn(() => qbChain);
    qbChain.delete = jest.fn(() => qbChain);
    qbChain.from = jest.fn(() => qbChain);
    qbChain.where = jest.fn(() => qbChain);
    qbChain.andWhere = jest.fn(() => qbChain);
    qbChain.execute = qbExecute;

    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn(),
      create: jest.fn((entity) => entity as AgentKeyRotationRule),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => qbChain),
    };
    cache = {
      getKeyRotationRules: jest.fn().mockReturnValue(null),
      setKeyRotationRules: jest.fn(),
      invalidateKeyRotationRules: jest.fn(),
    };

    service = new KeyRotationRuleService(repo as never, cache as unknown as RoutingCacheService);
  });

  const row = (overrides: Partial<AgentKeyRotationRule> = {}): AgentKeyRotationRule =>
    ({
      id: 'rule-1',
      tenant_id: 'tenant-1',
      agent_id: 'agent-1',
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      key_order: ['Work', 'Personal'],
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
      ...overrides,
    }) as AgentKeyRotationRule;

  describe('list', () => {
    it('returns the cached rows when present (no DB hit)', async () => {
      const cached = [row()];
      cache.getKeyRotationRules.mockReturnValueOnce(cached);

      const result = await service.list('agent-1');

      expect(result).toBe(cached);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('hits the DB and caches the result on a miss', async () => {
      const rows = [row()];
      repo.find.mockResolvedValue(rows);

      const result = await service.list('agent-1');

      expect(repo.find).toHaveBeenCalledWith({ where: { agent_id: 'agent-1' } });
      expect(cache.setKeyRotationRules).toHaveBeenCalledWith('agent-1', rows);
      expect(result).toBe(rows);
    });
  });

  describe('getRule', () => {
    it('returns the shared-shape rule for the agent (case-insensitive model match)', async () => {
      repo.find.mockResolvedValue([row({ model: 'Claude-Sonnet-4' })]);

      const result = await service.getRule('claude-sonnet-4', 'agent-1');

      expect(result).toEqual({
        id: 'rule-1',
        agentId: 'agent-1',
        model: 'Claude-Sonnet-4',
        provider: 'anthropic',
        keyOrder: ['Work', 'Personal'],
        createdAt: '2026-01-01T00:00:00',
        updatedAt: '2026-01-01T00:00:00',
      });
    });

    it('returns null when no rule exists for the model (steady state)', async () => {
      repo.find.mockResolvedValue([row({ model: 'gpt-4o' })]);

      const result = await service.getRule('claude-sonnet-4', 'agent-1');

      expect(result).toBeNull();
    });
  });

  describe('replace — validation', () => {
    it('rejects an empty keyOrder', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          { agentId: 'agent-1', model: 'gpt-4o', provider: 'openai', keyOrder: [] },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('rejects duplicate key labels (case-insensitive)', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          { agentId: 'agent-1', model: 'gpt-4o', provider: 'openai', keyOrder: ['Work', 'work'] },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
    });

    it('rejects duplicate rules for the same model', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          { agentId: 'agent-1', model: 'gpt-4o', provider: 'openai', keyOrder: ['A'] },
          { agentId: 'agent-1', model: 'GPT-4o', provider: 'openai', keyOrder: ['B'] },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
    });

    it('requires an explicit provider when the model name cannot infer one', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          // The controller maps an omitted provider to '' (see KeyRulesController).
          { agentId: 'agent-1', model: 'gpt-4o', provider: '', keyOrder: ['Work'] },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('infers the provider from the model name when omitted', async () => {
      repo.find.mockResolvedValue([row()]);

      const saved = await service.replace('agent-1', 'tenant-1', [
        {
          agentId: 'agent-1',
          model: 'anthropic/claude-sonnet-4',
          provider: '',
          keyOrder: ['Work', 'Personal'],
        },
      ]);

      expect(qbExecute).toHaveBeenCalledTimes(2); // upsert + delete diff
      expect(qbChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'agent-1',
          tenant_id: 'tenant-1',
          // Provider-qualified models are reduced to the bare runtime id.
          model: 'claude-sonnet-4',
          provider: 'anthropic',
          key_order: ['Work', 'Personal'],
        }),
      );
      expect(saved).toEqual([row()]);
    });

    it('normalizes dotted Anthropic ids to the runtime short form at write time', async () => {
      repo.find.mockResolvedValue([]);

      await service.replace('agent-1', 'tenant-1', [
        { agentId: 'agent-1', model: 'claude-sonnet-4.5', provider: 'anthropic', keyOrder: ['A'] },
      ]);

      expect(qbChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-5' }),
      );
    });

    it('strips the anthropic/ prefix when it names the rule provider', async () => {
      repo.find.mockResolvedValue([]);

      await service.replace('agent-1', 'tenant-1', [
        {
          agentId: 'agent-1',
          model: 'anthropic/claude-sonnet-4-5',
          provider: '',
          keyOrder: ['A'],
        },
      ]);

      expect(qbChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-5', provider: 'anthropic' }),
      );
    });

    it('leaves non-anthropic ids unchanged', async () => {
      repo.find.mockResolvedValue([]);

      await service.replace('agent-1', 'tenant-1', [
        { agentId: 'agent-1', model: 'gpt-4o', provider: 'openai', keyOrder: ['A'] },
        { agentId: 'agent-1', model: 'deepseek-v4-flash', provider: 'deepseek', keyOrder: ['B'] },
      ]);

      const calls = qbChain.values.mock.calls.map((c) => c[0] as { model: string });
      expect(calls.map((c) => c.model)).toEqual(['gpt-4o', 'deepseek-v4-flash']);
    });

    it('treats normalized-equivalent models as duplicates of the same rule', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          {
            agentId: 'agent-1',
            model: 'claude-sonnet-4.5',
            provider: 'anthropic',
            keyOrder: ['A'],
          },
          {
            agentId: 'agent-1',
            model: 'anthropic/claude-sonnet-4-5',
            provider: '',
            keyOrder: ['B'],
          },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
    });
  });

  describe('replace — upsert/delete diff', () => {
    it('upserts each rule and deletes rows the payload no longer mentions', async () => {
      repo.find.mockResolvedValue([row({ id: 'rule-new' })]);

      const saved = await service.replace('agent-1', 'tenant-1', [
        { agentId: 'agent-1', model: 'claude-sonnet-4', provider: 'Anthropic', keyOrder: ['A'] },
        { agentId: 'agent-1', model: 'gpt-4o', provider: 'openai', keyOrder: ['B'] },
      ]);

      // One upsert per rule + one NOT IN delete for the diff.
      expect(qbExecute).toHaveBeenCalledTimes(3);
      // …and a NOT IN delete for anything else the agent had.
      const deleteQb = qbChain.delete;
      expect(deleteQb).toHaveBeenCalled();
      expect(qbChain.where).toHaveBeenCalledWith('agent_id = :agentId', { agentId: 'agent-1' });
      expect(qbChain.andWhere).toHaveBeenCalledWith('model NOT IN (:...models)', {
        models: ['claude-sonnet-4', 'gpt-4o'],
      });
      // Cache dropped so the next read sees the new rows.
      expect(cache.invalidateKeyRotationRules).toHaveBeenCalledWith('agent-1');
      expect(saved).toEqual([row({ id: 'rule-new' })]);
    });

    it('clears every rule when the payload is empty', async () => {
      repo.find.mockResolvedValue([]);

      const saved = await service.replace('agent-1', 'tenant-1', []);

      expect(repo.delete).toHaveBeenCalledWith({ agent_id: 'agent-1' });
      expect(qbExecute).not.toHaveBeenCalled();
      expect(cache.invalidateKeyRotationRules).toHaveBeenCalledWith('agent-1');
      expect(saved).toEqual([]);
    });
  });
});
