import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { HeaderTierService } from './header-tier.service';
import { HeaderTier } from '../../entities/header-tier.entity';
import { RoutingCacheService } from '../routing-core/routing-cache.service';

type Repo = jest.Mocked<
  Pick<Repository<HeaderTier>, 'find' | 'findOne' | 'insert' | 'save' | 'delete'>
>;

function makeRepo(): Repo {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    delete: jest.fn().mockResolvedValue(undefined),
  } as unknown as Repo;
}

function makeCache() {
  return {
    getHeaderTiers: jest.fn().mockReturnValue(null),
    setHeaderTiers: jest.fn(),
    invalidateAgent: jest.fn(),
  } as unknown as jest.Mocked<RoutingCacheService>;
}

function makeService() {
  const repo = makeRepo();
  const cache = makeCache();
  const svc = new HeaderTierService(repo as unknown as Repository<HeaderTier>, cache);
  return { svc, repo, cache };
}

const validInput = {
  name: 'Premium',
  header_key: 'x-manifest-tier',
  header_value: 'premium',
  badge_color: 'indigo' as const,
};

describe('HeaderTierService', () => {
  describe('list', () => {
    it('returns cached rows when present', async () => {
      const { svc, cache, repo } = makeService();
      const rows = [{ id: '1' } as HeaderTier];
      (cache.getHeaderTiers as jest.Mock).mockReturnValue(rows);
      const result = await svc.list('a1');
      expect(result).toBe(rows);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('fetches and caches when miss', async () => {
      const { svc, cache, repo } = makeService();
      const rows = [{ id: '1' } as HeaderTier];
      repo.find.mockResolvedValue(rows);
      const result = await svc.list('a1');
      expect(repo.find).toHaveBeenCalledWith({
        where: { agent_id: 'a1' },
        order: { sort_order: 'ASC' },
      });
      expect(cache.setHeaderTiers).toHaveBeenCalledWith('a1', rows);
      expect(result).toBe(rows);
    });
  });

  describe('create', () => {
    it('inserts a new tier with sort_order = max+1 and invalidates cache', async () => {
      const { svc, repo, cache } = makeService();
      // Mix decreasing and increasing orders so both branches of the reduce
      // ternary (new max and retained max) are exercised.
      repo.find.mockResolvedValue([
        { name: 'Other1', header_key: 'x-a', header_value: 'a', sort_order: 5 } as HeaderTier,
        { name: 'Other2', header_key: 'x-b', header_value: 'b', sort_order: 2 } as HeaderTier,
      ]);
      const out = await svc.create('a1', 'u1', 't1', validInput);
      expect(out.sort_order).toBe(6);
      expect(out.name).toBe('Premium');
      expect(out.header_key).toBe('x-manifest-tier');
      expect(out.badge_color).toBe('indigo');
      expect(repo.insert).toHaveBeenCalledTimes(1);
      expect(cache.invalidateAgent).toHaveBeenCalledWith('a1');
    });

    it('starts sort_order at 0 when no siblings exist', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      const out = await svc.create('a1', 'u1', null, validInput);
      expect(out.sort_order).toBe(0);
    });

    it('rejects empty name', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(svc.create('a1', 'u1', null, { ...validInput, name: '   ' })).rejects.toThrow(
        /Name is required/,
      );
    });

    it('rejects name longer than 32 chars', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, { ...validInput, name: 'a'.repeat(33) }),
      ).rejects.toThrow(/32 characters/);
    });

    it('rejects duplicate name (case-insensitive)', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([{ name: 'premium' } as HeaderTier]);
      await expect(svc.create('a1', 'u1', null, validInput)).rejects.toThrow(
        /tier with this name already exists/,
      );
    });

    it('rejects empty header key', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(svc.create('a1', 'u1', null, { ...validInput, header_key: '' })).rejects.toThrow(
        /Header key is required/,
      );
    });

    it('rejects header key with invalid chars', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, { ...validInput, header_key: 'X Tier' }),
      ).rejects.toThrow(/lowercase letters, digits, and hyphens/);
    });

    it('rejects denylisted header keys', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, { ...validInput, header_key: 'authorization' }),
      ).rejects.toThrow(/stripped for security/);
    });

    it('rejects empty header value', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, { ...validInput, header_value: '' }),
      ).rejects.toThrow(/Header value is required/);
    });

    it('rejects header value longer than 128 chars', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, { ...validInput, header_value: 'x'.repeat(129) }),
      ).rejects.toThrow(/128 characters/);
    });

    it('rejects invalid badge color', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, {
          ...validInput,
          badge_color: 'neon' as never,
        }),
      ).rejects.toThrow(/Invalid badge color/);
    });

    it('rejects duplicate (key, value) rule', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([
        { name: 'Other', header_key: 'x-manifest-tier', header_value: 'premium' } as HeaderTier,
      ]);
      await expect(svc.create('a1', 'u1', null, validInput)).rejects.toThrow(
        /already matches this header key and value/,
      );
    });

    it('lowercases the header key before saving', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      const out = await svc.create('a1', 'u1', null, {
        ...validInput,
        header_key: 'X-MANIFEST-TIER',
      });
      expect(out.header_key).toBe('x-manifest-tier');
    });

    it('treats a null name as empty', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, { ...validInput, name: null as unknown as string }),
      ).rejects.toThrow(/Name is required/);
    });

    it('treats a null header_key as empty', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, { ...validInput, header_key: null as unknown as string }),
      ).rejects.toThrow(/Header key is required/);
    });

    it('treats a null header_value as empty', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([]);
      await expect(
        svc.create('a1', 'u1', null, { ...validInput, header_value: null as unknown as string }),
      ).rejects.toThrow(/Header value is required/);
    });
  });

  describe('update', () => {
    it('throws NotFound when id does not belong to the agent', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue(null);
      await expect(svc.update('a1', 'missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates name + header + value + color and invalidates cache', async () => {
      const { svc, repo, cache } = makeService();
      repo.findOne.mockResolvedValue({
        id: 'h1',
        agent_id: 'a1',
        name: 'Old',
        header_key: 'x-a',
        header_value: 'v',
        badge_color: 'slate',
      } as HeaderTier);
      repo.find.mockResolvedValue([
        {
          id: 'h1',
          name: 'Old',
          header_key: 'x-a',
          header_value: 'v',
        } as HeaderTier,
      ]);
      const out = await svc.update('a1', 'h1', {
        name: 'New',
        header_key: 'x-b',
        header_value: 'vv',
        badge_color: 'rose',
      });
      expect(out.name).toBe('New');
      expect(out.header_key).toBe('x-b');
      expect(out.header_value).toBe('vv');
      expect(out.badge_color).toBe('rose');
      expect(cache.invalidateAgent).toHaveBeenCalledWith('a1');
    });

    it('rejects updating name to one used by a sibling', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue({ id: 'h1', agent_id: 'a1', name: 'Old' } as HeaderTier);
      repo.find.mockResolvedValue([
        { id: 'h1', name: 'Old' } as HeaderTier,
        { id: 'h2', name: 'Taken' } as HeaderTier,
      ]);
      await expect(svc.update('a1', 'h1', { name: 'Taken' })).rejects.toThrow(
        /tier with this name already exists/,
      );
    });

    it('rejects updating rule to one used by a sibling', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue({
        id: 'h1',
        agent_id: 'a1',
        header_key: 'x-a',
        header_value: 'v',
      } as HeaderTier);
      repo.find.mockResolvedValue([
        { id: 'h1', header_key: 'x-a', header_value: 'v' } as HeaderTier,
        { id: 'h2', header_key: 'x-b', header_value: 'taken' } as HeaderTier,
      ]);
      await expect(
        svc.update('a1', 'h1', { header_key: 'x-b', header_value: 'taken' }),
      ).rejects.toThrow(/already matches this header key and value/);
    });
  });

  describe('delete', () => {
    it('deletes the tier and invalidates cache', async () => {
      const { svc, repo, cache } = makeService();
      repo.findOne.mockResolvedValue({ id: 'h1', agent_id: 'a1' } as HeaderTier);
      await svc.delete('a1', 'h1');
      expect(repo.delete).toHaveBeenCalledWith({ id: 'h1' });
      expect(cache.invalidateAgent).toHaveBeenCalledWith('a1');
    });

    it('throws NotFound when missing', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue(null);
      await expect(svc.delete('a1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('assigns sort_order by position', async () => {
      const { svc, repo, cache } = makeService();
      const rows = [
        { id: 'a', sort_order: 0 } as HeaderTier,
        { id: 'b', sort_order: 1 } as HeaderTier,
        { id: 'c', sort_order: 2 } as HeaderTier,
      ];
      repo.find.mockResolvedValue(rows);
      await svc.reorder('a1', ['c', 'a', 'b']);
      expect(rows.find((r) => r.id === 'c')!.sort_order).toBe(0);
      expect(rows.find((r) => r.id === 'a')!.sort_order).toBe(1);
      expect(rows.find((r) => r.id === 'b')!.sort_order).toBe(2);
      expect(cache.invalidateAgent).toHaveBeenCalledWith('a1');
    });

    it('rejects mismatched length', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([{ id: 'a' } as HeaderTier, { id: 'b' } as HeaderTier]);
      await expect(svc.reorder('a1', ['a'])).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown ids', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([{ id: 'a' } as HeaderTier, { id: 'b' } as HeaderTier]);
      await expect(svc.reorder('a1', ['a', 'c'])).rejects.toThrow(BadRequestException);
    });

    it('rejects non-array payloads (guards against loop-bound injection)', async () => {
      const { svc } = makeService();
      await expect(svc.reorder('a1', 'not-an-array' as unknown as string[])).rejects.toThrow(
        /must be an array/,
      );
    });

    it('rejects duplicate ids', async () => {
      const { svc, repo } = makeService();
      repo.find.mockResolvedValue([{ id: 'a' } as HeaderTier, { id: 'b' } as HeaderTier]);
      await expect(svc.reorder('a1', ['a', 'a'])).rejects.toThrow(/duplicate ids/);
    });
  });

  describe('override + fallbacks', () => {
    it('setOverride writes model/provider/auth and saves', async () => {
      const { svc, repo, cache } = makeService();
      repo.findOne.mockResolvedValue({ id: 'h1', agent_id: 'a1' } as HeaderTier);
      const out = await svc.setOverride('a1', 'h1', 'gpt-4o', 'OpenAI', 'api_key');
      expect(out.override_model).toBe('gpt-4o');
      expect(out.override_provider).toBe('OpenAI');
      expect(out.override_auth_type).toBe('api_key');
      expect(cache.invalidateAgent).toHaveBeenCalled();
    });

    it('setOverride accepts missing optional fields', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue({ id: 'h1', agent_id: 'a1' } as HeaderTier);
      const out = await svc.setOverride('a1', 'h1', 'gpt-4o');
      expect(out.override_provider).toBeNull();
      expect(out.override_auth_type).toBeNull();
    });

    it('clearOverride nulls model/provider/auth/fallbacks', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue({
        id: 'h1',
        agent_id: 'a1',
        override_model: 'gpt-4o',
        fallback_models: ['claude'],
      } as HeaderTier);
      await svc.clearOverride('a1', 'h1');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          fallback_models: null,
        }),
      );
    });

    it('setFallbacks stores array and returns it', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue({ id: 'h1', agent_id: 'a1' } as HeaderTier);
      const out = await svc.setFallbacks('a1', 'h1', ['a', 'b']);
      expect(out).toEqual(['a', 'b']);
    });

    it('setFallbacks([]) stores null', async () => {
      const { svc, repo } = makeService();
      const row = { id: 'h1', agent_id: 'a1', fallback_models: ['a'] } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      await svc.setFallbacks('a1', 'h1', []);
      expect(row.fallback_models).toBeNull();
    });

    it('clearFallbacks nulls fallback_models', async () => {
      const { svc, repo } = makeService();
      const row = { id: 'h1', agent_id: 'a1', fallback_models: ['a'] } as HeaderTier;
      repo.findOne.mockResolvedValue(row);
      await svc.clearFallbacks('a1', 'h1');
      expect(row.fallback_models).toBeNull();
    });
  });
});
