import { BadRequestException } from '@nestjs/common';
import { Brackets } from 'typeorm';
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
      scope: 'model',
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
        scope: 'model',
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

    it('a model-scope rule wins over the provider-scope rule for the same provider', async () => {
      repo.find.mockResolvedValue([
        row({
          id: 'provider-rule',
          model: null,
          provider: 'openai',
          scope: 'provider',
          key_order: ['X', 'Y'],
        }),
        row({
          id: 'model-rule',
          model: 'gpt-4o',
          provider: 'openai',
          scope: 'model',
          key_order: ['A', 'B'],
        }),
      ]);

      const result = await service.getRule('gpt-4o', 'agent-1', 'openai');

      expect(result!.id).toBe('model-rule');
      expect(result!.scope).toBe('model');
      expect(result!.keyOrder).toEqual(['A', 'B']);
    });

    it('returns the provider-scope rule when no model rule matches (explicit provider)', async () => {
      repo.find.mockResolvedValue([
        row({
          id: 'provider-rule',
          model: null,
          provider: 'openai',
          scope: 'provider',
          key_order: ['X', 'Y'],
        }),
      ]);

      const result = await service.getRule('gpt-4o', 'agent-1', 'openai');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'provider-rule',
          model: null,
          provider: 'openai',
          scope: 'provider',
          keyOrder: ['X', 'Y'],
        }),
      );
    });

    it('does not apply a provider-scope rule to a different provider', async () => {
      repo.find.mockResolvedValue([
        row({
          id: 'provider-rule',
          model: null,
          provider: 'openai',
          scope: 'provider',
          key_order: ['X'],
        }),
      ]);

      const result = await service.getRule('claude-sonnet-4', 'agent-1', 'anthropic');

      expect(result).toBeNull();
    });

    it('does not apply a model rule whose provider differs from the route provider', async () => {
      repo.find.mockResolvedValue([
        // Same model name, but scoped to a provider that is NOT routing it.
        row({
          id: 'openai-rule',
          model: 'gpt-4o',
          provider: 'openai',
          scope: 'model',
          key_order: ['A'],
        }),
      ]);

      const result = await service.getRule('gpt-4o', 'agent-1', 'anthropic');

      // Falls through to the provider-scope lookup for anthropic: none.
      expect(result).toBeNull();
    });

    it('applies a model rule when its provider matches the route provider', async () => {
      repo.find.mockResolvedValue([
        row({
          id: 'openai-rule',
          model: 'gpt-4o',
          provider: 'openai',
          scope: 'model',
          key_order: ['A'],
        }),
      ]);

      const result = await service.getRule('gpt-4o', 'agent-1', 'openai');

      expect(result!.id).toBe('openai-rule');
    });
  });

  describe('replace — validation', () => {
    it('rejects an empty keyOrder', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          { agentId: 'agent-1', model: 'gpt-4o', provider: 'openai', scope: 'model', keyOrder: [] },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('rejects duplicate key labels (case-insensitive)', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          {
            agentId: 'agent-1',
            model: 'gpt-4o',
            provider: 'openai',
            scope: 'model',
            keyOrder: ['Work', 'work'],
          },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
    });

    it('rejects duplicate rules for the same model', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          {
            agentId: 'agent-1',
            model: 'gpt-4o',
            provider: 'openai',
            scope: 'model',
            keyOrder: ['A'],
          },
          {
            agentId: 'agent-1',
            model: 'GPT-4o',
            provider: 'openai',
            scope: 'model',
            keyOrder: ['B'],
          },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
    });

    it('rejects a provider-scope rule that carries a model (400, not silent drop)', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          {
            agentId: 'agent-1',
            model: 'gpt-4o',
            provider: 'openai',
            scope: 'provider',
            keyOrder: ['A'],
          },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
    });

    it('rejects a model-scope rule without a model', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          { agentId: 'agent-1', model: null, provider: 'openai', scope: 'model', keyOrder: ['A'] },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
    });

    it('rejects duplicate provider-scope rules for the same provider', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          {
            agentId: 'agent-1',
            model: null,
            provider: 'openai',
            scope: 'provider',
            keyOrder: ['A'],
          },
          {
            agentId: 'agent-1',
            model: null,
            provider: 'OpenAI',
            scope: 'provider',
            keyOrder: ['B'],
          },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(qbExecute).not.toHaveBeenCalled();
    });

    it('requires an explicit provider for every rule', async () => {
      await expect(
        service.replace('agent-1', 'tenant-1', [
          // The controller maps an omitted provider to '' (see KeyRulesController).
          // Even a model-scope rule needs its provider — the labels belong to it.
          { agentId: 'agent-1', model: 'gpt-4o', provider: '', scope: 'model', keyOrder: ['Work'] },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('reduces a provider-qualified model to the bare runtime id', async () => {
      repo.find.mockResolvedValue([row()]);

      const saved = await service.replace('agent-1', 'tenant-1', [
        {
          agentId: 'agent-1',
          model: 'anthropic/claude-sonnet-4',
          provider: 'anthropic',
          scope: 'model',
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
          scope: 'model',
          key_order: ['Work', 'Personal'],
        }),
      );
      expect(saved).toEqual([row()]);
    });

    it('normalizes dotted Anthropic ids to the runtime short form at write time', async () => {
      repo.find.mockResolvedValue([]);

      await service.replace('agent-1', 'tenant-1', [
        {
          agentId: 'agent-1',
          model: 'claude-sonnet-4.5',
          provider: 'anthropic',
          scope: 'model',
          keyOrder: ['A'],
        },
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
          provider: 'anthropic',
          scope: 'model',
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
        {
          agentId: 'agent-1',
          model: 'gpt-4o',
          provider: 'openai',
          scope: 'model',
          keyOrder: ['A'],
        },
        {
          agentId: 'agent-1',
          model: 'deepseek-v4-flash',
          provider: 'deepseek',
          scope: 'model',
          keyOrder: ['B'],
        },
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
            scope: 'model',
            keyOrder: ['A'],
          },
          {
            agentId: 'agent-1',
            model: 'anthropic/claude-sonnet-4-5',
            provider: '',
            scope: 'model',
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
        {
          agentId: 'agent-1',
          model: 'claude-sonnet-4',
          provider: 'Anthropic',
          scope: 'model',
          keyOrder: ['A'],
        },
        {
          agentId: 'agent-1',
          model: 'gpt-4o',
          provider: 'openai',
          scope: 'model',
          keyOrder: ['B'],
        },
      ]);

      // One upsert per rule + one NOT IN delete for the diff.
      expect(qbExecute).toHaveBeenCalledTimes(3);
      // …and a NOT IN delete for anything else the agent had. The delete is
      // scoped per rule scope (model rows by model, provider rows by provider);
      // an all-model payload emits only the model branch.
      const deleteQb = qbChain.delete;
      expect(deleteQb).toHaveBeenCalled();
      expect(qbChain.where).toHaveBeenCalledWith('agent_id = :agentId', { agentId: 'agent-1' });
      expect(qbChain.andWhere).toHaveBeenCalledWith(expect.any(Brackets), {
        models: ['claude-sonnet-4', 'gpt-4o'],
      });
      const subQb: { where: jest.Mock } = { where: jest.fn() };
      subQb.where.mockReturnValue(subQb);
      const brackets = qbChain.andWhere.mock.calls[0][0] as Brackets;
      brackets.whereFactory(subQb as never);
      expect(subQb.where).toHaveBeenCalledWith("scope = 'model' AND model NOT IN (:...models)");
      expect(subQb.where).not.toHaveBeenCalledWith(expect.stringContaining(':...providers'));
      // The provider scope was empty, so no providers parameter is sent.
      expect(qbChain.andWhere.mock.calls[0][1]).not.toHaveProperty('providers');
      // Cache dropped so the next read sees the new rows.
      expect(cache.invalidateKeyRotationRules).toHaveBeenCalledWith('agent-1');
      expect(saved).toEqual([row({ id: 'rule-new' })]);
    });

    it('upserts provider-scope rules with a null model, keyed on (agent_id, provider)', async () => {
      repo.find.mockResolvedValue([]);

      await service.replace('agent-1', 'tenant-1', [
        {
          agentId: 'agent-1',
          model: null,
          provider: 'openai',
          scope: 'provider',
          keyOrder: ['Work', 'Personal'],
        },
      ]);

      expect(qbChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'agent-1',
          tenant_id: 'tenant-1',
          model: null,
          provider: 'openai',
          scope: 'provider',
          key_order: ['Work', 'Personal'],
        }),
      );
      // Provider-scope upserts conflict on (agent_id, provider) via the
      // partial unique index on scope = 'provider'.
      expect(qbChain.orUpdate).toHaveBeenCalledWith(
        ['provider', 'key_order', 'scope', 'updated_at'],
        ['agent_id', 'provider'],
        { indexPredicate: "scope = 'provider'" },
      );
    });

    it('deletes model and provider rows the payload no longer mentions, per scope', async () => {
      repo.find.mockResolvedValue([]);

      await service.replace('agent-1', 'tenant-1', [
        {
          agentId: 'agent-1',
          model: 'gpt-4o',
          provider: 'openai',
          scope: 'model',
          keyOrder: ['A'],
        },
        {
          agentId: 'agent-1',
          model: null,
          provider: 'anthropic',
          scope: 'provider',
          keyOrder: ['B'],
        },
      ]);

      expect(qbChain.andWhere).toHaveBeenCalledWith(expect.any(Brackets), {
        models: ['gpt-4o'],
        providers: ['anthropic'],
      });
      const brackets = qbChain.andWhere.mock.calls[0][0] as Brackets;
      expect(brackets).toBeInstanceOf(Brackets);
      const subQb: { where: jest.Mock } = { where: jest.fn() };
      subQb.where.mockReturnValue(subQb);
      brackets.whereFactory(subQb as never);
      expect(subQb.where).toHaveBeenCalledWith(
        "scope = 'model' AND model NOT IN (:...models) OR scope = 'provider' AND provider NOT IN (:...providers)",
      );
    });

    it('homogeneous-scope PUTs never emit an empty NOT IN branch (no 500)', async () => {
      repo.find.mockResolvedValue([]);

      // All-model PUT: no provider branch (an empty array would expand to
      // `NOT IN ('')`, and Postgres rejects `NOT IN ()` outright).
      await service.replace('agent-1', 'tenant-1', [
        {
          agentId: 'agent-1',
          model: 'gpt-4o',
          provider: 'openai',
          scope: 'model',
          keyOrder: ['A'],
        },
      ]);
      expect(qbChain.andWhere).toHaveBeenCalledWith(expect.any(Brackets), {
        models: ['gpt-4o'],
      });
      expect(qbChain.andWhere.mock.calls[0][1]).not.toHaveProperty('providers');
      let brackets = qbChain.andWhere.mock.calls[0][0] as Brackets;
      let sub: { where: jest.Mock } = { where: jest.fn(() => sub) };
      brackets.whereFactory(sub as never);
      expect(sub.where).toHaveBeenCalledWith("scope = 'model' AND model NOT IN (:...models)");

      // All-provider PUT: no model branch.
      await service.replace('agent-1', 'tenant-1', [
        {
          agentId: 'agent-1',
          model: null,
          provider: 'openai',
          scope: 'provider',
          keyOrder: ['A'],
        },
      ]);
      expect(qbChain.andWhere).toHaveBeenLastCalledWith(expect.any(Brackets), {
        providers: ['openai'],
      });
      expect(qbChain.andWhere.mock.calls[1][1]).not.toHaveProperty('models');
      brackets = qbChain.andWhere.mock.calls[1][0] as Brackets;
      sub = { where: jest.fn(() => sub) };
      brackets.whereFactory(sub as never);
      expect(sub.where).toHaveBeenCalledWith(
        "scope = 'provider' AND provider NOT IN (:...providers)",
      );
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
