jest.mock('../../common/utils/url-validation', () => ({
  validatePublicUrl: jest.fn(),
}));
jest.mock('../../common/utils/detect-self-hosted', () => ({
  isSelfHosted: jest.fn().mockReturnValue(false),
}));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CustomProviderService } from './custom-provider.service';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ProviderService } from '../routing-core/provider.service';
import { RoutingCacheService } from '../routing-core/routing-cache.service';
import { TierAutoAssignService } from '../routing-core/tier-auto-assign.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validatePublicUrl } = require('../../common/utils/url-validation');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isSelfHosted } = require('../../common/utils/detect-self-hosted');

function makeDeps(overrides: {
  findOneResults?: (CustomProvider | null)[];
  findResult?: CustomProvider[];
  cached?: CustomProvider[] | null;
}) {
  const findOne = jest.fn();
  const find = jest.fn().mockResolvedValue(overrides.findResult ?? []);
  const insert = jest.fn().mockResolvedValue(undefined);
  const save = jest.fn().mockResolvedValue(undefined);
  const remove = jest.fn().mockResolvedValue(undefined);

  const results = overrides.findOneResults ?? [];
  findOne.mockImplementation(() => Promise.resolve(results.shift() ?? null));

  const repo = { findOne, find, insert, save, remove } as unknown as Repository<CustomProvider>;

  const upsertProvider = jest.fn().mockResolvedValue({ provider: {} });
  const removeProvider = jest.fn().mockResolvedValue(undefined);
  const retagAuthType = jest.fn().mockResolvedValue(undefined);
  const providerService = {
    upsertProvider,
    removeProvider,
    retagAuthType,
  } as unknown as ProviderService;

  const getCustomProviders = jest.fn().mockReturnValue(overrides.cached ?? null);
  const setCustomProviders = jest.fn();
  const invalidateAgent = jest.fn();
  const routingCache = {
    getCustomProviders,
    setCustomProviders,
    invalidateAgent,
  } as unknown as RoutingCacheService;

  const recalculate = jest.fn().mockResolvedValue(undefined);
  const autoAssign = { recalculate } as unknown as TierAutoAssignService;

  const reloadPricing = jest.fn().mockResolvedValue(undefined);
  const pricingCache = { reload: reloadPricing } as unknown as ModelPricingCacheService;

  const svc = new CustomProviderService(
    repo,
    providerService,
    routingCache,
    autoAssign,
    pricingCache,
  );

  return {
    svc,
    findOne,
    find,
    insert,
    save,
    remove,
    upsertProvider,
    removeProvider,
    retagAuthType,
    getCustomProviders,
    setCustomProviders,
    invalidateAgent,
    recalculate,
    reloadPricing,
  };
}

describe('CustomProviderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validatePublicUrl as jest.Mock).mockReset();
    (validatePublicUrl as jest.Mock).mockResolvedValue(undefined);
    (isSelfHosted as jest.Mock).mockReset();
    (isSelfHosted as jest.Mock).mockReturnValue(false);
  });

  describe('static helpers', () => {
    it('composes and parses provider keys and model keys', () => {
      expect(CustomProviderService.providerKey('abc')).toBe('custom:abc');
      expect(CustomProviderService.modelKey('abc', 'model')).toBe('custom:abc/model');
      // rawModelName strips through the first "/" so the proxy sends just the upstream name.
      expect(CustomProviderService.rawModelName('custom:abc/model')).toBe('model');
      expect(CustomProviderService.rawModelName('plain-model')).toBe('plain-model');
    });

    it('detects custom provider keys and extracts their id', () => {
      expect(CustomProviderService.isCustom('custom:abc')).toBe(true);
      expect(CustomProviderService.isCustom('anthropic')).toBe(false);
      expect(CustomProviderService.extractId('custom:abc')).toBe('abc');
    });

    it('maps tile-connected canonical names to their registry id', () => {
      expect(CustomProviderService.canonicalTileIdForName('llama.cpp')).toBe('llamacpp');
      expect(CustomProviderService.canonicalTileIdForName('llama-cpp')).toBe('llamacpp');
      expect(CustomProviderService.canonicalTileIdForName('LM Studio')).toBe('lmstudio');
      expect(CustomProviderService.canonicalTileIdForName('Groq')).toBeNull();
      expect(CustomProviderService.canonicalTileIdForName('My Custom LLM')).toBeNull();
    });
  });

  describe('canonicalizeAgentMessageKeys', () => {
    it('rewrites provider + model when the custom provider is a tile-only canonical (llama.cpp)', async () => {
      const row = {
        id: 'cp-llamacpp',
        agent_id: 'agent-1',
        name: 'llama.cpp',
      } as CustomProvider;
      const { svc } = makeDeps({ cached: [row] });

      const out = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        'custom:cp-llamacpp',
        'custom:cp-llamacpp/qwen2.5-0.5b-q4.gguf',
      );
      expect(out).toEqual({ provider: 'llamacpp', model: 'llamacpp/qwen2.5-0.5b-q4.gguf' });
    });

    it('passes through user-defined custom providers that do not match a tile-only canonical', async () => {
      const row = {
        id: 'cp-mine',
        agent_id: 'agent-1',
        name: 'My Groq',
      } as CustomProvider;
      const { svc } = makeDeps({ cached: [row] });

      const out = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        'custom:cp-mine',
        'custom:cp-mine/llama-3.1-70b',
      );
      expect(out).toEqual({ provider: 'custom:cp-mine', model: 'custom:cp-mine/llama-3.1-70b' });
    });

    it('passes through cloud providers (no custom: prefix)', async () => {
      const { svc } = makeDeps({ cached: [] });
      const out = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        'anthropic',
        'anthropic/claude-opus-4-6',
      );
      expect(out).toEqual({ provider: 'anthropic', model: 'anthropic/claude-opus-4-6' });
    });

    it('rewrites a custom-prefixed model string even when provider is null (fallback_from_model)', async () => {
      const row = {
        id: 'cp-llamacpp',
        agent_id: 'agent-1',
        name: 'llama.cpp',
      } as CustomProvider;
      const { svc } = makeDeps({ cached: [row] });
      const out = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        null,
        'custom:cp-llamacpp/qwen2.5-0.5b-q4.gguf',
      );
      expect(out).toEqual({ provider: null, model: 'llamacpp/qwen2.5-0.5b-q4.gguf' });
    });

    it('returns nulls when both provider and model are empty', async () => {
      const { svc } = makeDeps({ cached: [] });
      const out = await svc.canonicalizeAgentMessageKeys('agent-1', null, null);
      expect(out).toEqual({ provider: null, model: null });
    });

    it('returns provider unchanged when the referenced custom provider no longer exists', async () => {
      const { svc } = makeDeps({ cached: [] });
      const out = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        'custom:deleted',
        'custom:deleted/foo',
      );
      expect(out).toEqual({ provider: 'custom:deleted', model: 'custom:deleted/foo' });
    });

    it('returns the model unchanged when the fallback_from_model path references a deleted custom provider', async () => {
      // fallback_from_model can carry a `custom:<uuid>/model` suffix after the
      // backing provider row was removed — the canonicalizer must pass it
      // through rather than silently dropping the reference.
      const { svc } = makeDeps({ cached: [] });
      const out = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        null,
        'custom:missing-uuid/my-model',
      );
      expect(out).toEqual({ provider: null, model: 'custom:missing-uuid/my-model' });
    });

    it('rewrites only the provider when the model does not share the same custom prefix', async () => {
      // On cross-provider fallback, `model` can reference a *different*
      // upstream (e.g. the fallback landed on anthropic) while `provider`
      // is still the custom tile — the provider column must canonicalize
      // but the model must pass through untouched.
      const row = {
        id: 'cp-llamacpp',
        agent_id: 'agent-1',
        name: 'llama.cpp',
      } as CustomProvider;
      const { svc } = makeDeps({ cached: [row] });
      const out = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        'custom:cp-llamacpp',
        'anthropic/claude-opus-4-6',
      );
      expect(out).toEqual({ provider: 'llamacpp', model: 'anthropic/claude-opus-4-6' });
    });

    it('returns null model unchanged when the referenced provider row is missing', async () => {
      // Combines the "row not found" branch with a null model — the
      // canonicalizer must not invent a model string when none was supplied.
      const { svc } = makeDeps({ cached: [] });
      const out = await svc.canonicalizeAgentMessageKeys('agent-1', 'custom:deleted', null);
      expect(out).toEqual({ provider: 'custom:deleted', model: null });
    });

    it('returns null model unchanged for a user-defined (non-tileOnly) custom provider', async () => {
      // User-defined providers don't get canonicalized, and a missing model
      // must stay missing — no accidental "my-groq/null" strings in the DB.
      const row = {
        id: 'cp-mine',
        agent_id: 'agent-1',
        name: 'My Groq',
      } as CustomProvider;
      const { svc } = makeDeps({ cached: [row] });
      const out = await svc.canonicalizeAgentMessageKeys('agent-1', 'custom:cp-mine', null);
      expect(out).toEqual({ provider: 'custom:cp-mine', model: null });
    });

    it('rewrites provider and leaves model null when model is unset for a tile-only custom provider', async () => {
      // Some error paths record a provider without a model (e.g. pre-resolve
      // failures). The provider still canonicalizes, and the model column
      // must remain null rather than accidentally adopting a canonical prefix.
      const row = {
        id: 'cp-llamacpp',
        agent_id: 'agent-1',
        name: 'llama.cpp',
      } as CustomProvider;
      const { svc } = makeDeps({ cached: [row] });
      const out = await svc.canonicalizeAgentMessageKeys('agent-1', 'custom:cp-llamacpp', null);
      expect(out).toEqual({ provider: 'llamacpp', model: null });
    });
  });

  describe('list', () => {
    it('returns the cached result when present', async () => {
      const cached = [{ id: 'cp1' } as CustomProvider];
      const { svc, find, setCustomProviders } = makeDeps({ cached });
      const result = await svc.list('agent-1');
      expect(result).toBe(cached);
      expect(find).not.toHaveBeenCalled();
      expect(setCustomProviders).not.toHaveBeenCalled();
    });

    it('falls back to the DB and populates the cache on a miss', async () => {
      const rows = [{ id: 'cp1' } as CustomProvider];
      const { svc, find, setCustomProviders } = makeDeps({
        cached: null,
        findResult: rows,
      });
      const result = await svc.list('agent-1');
      expect(result).toBe(rows);
      expect(find).toHaveBeenCalledWith({ where: { agent_id: 'agent-1' } });
      expect(setCustomProviders).toHaveBeenCalledWith('agent-1', rows);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'my-openai',
      base_url: 'https://openai.example.com',
      apiKey: 'sk-x',
      models: [
        {
          model_name: 'gpt-custom',
          input_price_per_million_tokens: 1,
          output_price_per_million_tokens: 2,
          // context_window omitted → default 128_000
        },
      ],
    };

    it('throws Conflict when an agent already has a provider with the same name', async () => {
      const { svc } = makeDeps({ findOneResults: [{ id: 'existing' } as CustomProvider] });
      await expect(svc.create('agent-1', 'user-1', dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequest when the base URL fails validation', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(new Error('not public'));
      const { svc } = makeDeps({ findOneResults: [null] });
      await expect(svc.create('agent-1', 'user-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('inserts the row, upserts a UserProvider, and defaults context_window to 128k', async () => {
      const { svc, insert, upsertProvider, reloadPricing } = makeDeps({ findOneResults: [null] });
      const cp = await svc.create('agent-1', 'user-1', dto);

      expect(insert).toHaveBeenCalledTimes(1);
      expect(cp.agent_id).toBe('agent-1');
      expect(cp.name).toBe('my-openai');
      expect(cp.models[0].context_window).toBe(128_000);
      expect(upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        `custom:${cp.id}`,
        'sk-x',
        'api_key',
      );
      expect(validatePublicUrl).toHaveBeenCalledWith(dto.base_url, { allowPrivate: false });
      // Price lookup cache must be refreshed so the proxy can compute cost
      // for messages routed to this provider's models immediately.
      expect(reloadPricing).toHaveBeenCalledTimes(1);
    });

    it('tags the companion user_providers row as local when the name is LM Studio', async () => {
      const { svc, upsertProvider } = makeDeps({ findOneResults: [null] });
      await svc.create('agent-1', 'user-1', { ...dto, name: 'LM Studio' });
      expect(upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        expect.stringMatching(/^custom:/),
        'sk-x',
        'local',
      );
    });

    it('normalizes the name for detection (lm-studio / LMSTUDIO both resolve to local)', async () => {
      const { svc, upsertProvider } = makeDeps({ findOneResults: [null] });
      await svc.create('agent-1', 'user-1', { ...dto, name: 'lm-studio' });
      expect(upsertProvider).toHaveBeenLastCalledWith(
        'agent-1',
        'user-1',
        expect.stringMatching(/^custom:/),
        'sk-x',
        'local',
      );
    });

    it('keeps api_key tagging for freeform custom provider names', async () => {
      const { svc, upsertProvider } = makeDeps({ findOneResults: [null] });
      await svc.create('agent-1', 'user-1', { ...dto, name: 'My Home Server' });
      expect(upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        expect.stringMatching(/^custom:/),
        'sk-x',
        'api_key',
      );
    });

    it('passes allowPrivate=true in the self-hosted version so private URLs are accepted', async () => {
      (isSelfHosted as jest.Mock).mockReturnValue(true);
      const selfHostedDto = { ...dto, base_url: 'http://host.docker.internal:11434/v1' };
      const { svc } = makeDeps({ findOneResults: [null] });
      await svc.create('agent-1', 'user-1', selfHostedDto);
      expect(validatePublicUrl).toHaveBeenCalledWith(selfHostedDto.base_url, {
        allowPrivate: true,
      });
    });
  });

  describe('update', () => {
    it('throws NotFound when the provider does not exist for the agent', async () => {
      const { svc } = makeDeps({ findOneResults: [null] });
      await expect(
        svc.update('agent-1', 'missing', 'user-1', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Conflict when renaming collides with an existing provider', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'old' } as CustomProvider;
      const { svc } = makeDeps({
        findOneResults: [existing, { id: 'other', name: 'new' } as CustomProvider],
      });
      await expect(svc.update('agent-1', 'cp1', 'user-1', { name: 'new' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('renames and persists when no collision', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'old' } as CustomProvider;
      const { svc, save, invalidateAgent, reloadPricing } = makeDeps({
        findOneResults: [existing, null],
      });
      await svc.update('agent-1', 'cp1', 'user-1', { name: 'new' });
      expect(existing.name).toBe('new');
      expect(save).toHaveBeenCalledWith(existing);
      expect(invalidateAgent).toHaveBeenCalledWith('agent-1');
      // A rename-only update cannot affect prices, so the shared pricing
      // cache should be left alone (reload is expensive for large installs).
      expect(reloadPricing).not.toHaveBeenCalled();
    });

    it('validates and updates base_url when provided', async () => {
      const existing = {
        id: 'cp1',
        agent_id: 'agent-1',
        name: 'n',
        base_url: 'a',
      } as CustomProvider;
      const { svc } = makeDeps({ findOneResults: [existing] });
      await svc.update('agent-1', 'cp1', 'user-1', { base_url: 'https://b.example' });
      expect(validatePublicUrl).toHaveBeenCalledWith('https://b.example', { allowPrivate: false });
      expect(existing.base_url).toBe('https://b.example');
    });

    it('passes allowPrivate=true to validatePublicUrl in the self-hosted version', async () => {
      (isSelfHosted as jest.Mock).mockReturnValue(true);
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'n' } as CustomProvider;
      const { svc } = makeDeps({ findOneResults: [existing] });
      await svc.update('agent-1', 'cp1', 'user-1', {
        base_url: 'http://host.docker.internal:8000/v1',
      });
      expect(validatePublicUrl).toHaveBeenCalledWith('http://host.docker.internal:8000/v1', {
        allowPrivate: true,
      });
    });

    it('throws BadRequest when the new base_url fails validation', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'n' } as CustomProvider;
      const { svc } = makeDeps({ findOneResults: [existing] });
      (validatePublicUrl as jest.Mock).mockRejectedValue(new Error('bad url'));
      await expect(
        svc.update('agent-1', 'cp1', 'user-1', { base_url: 'http://bad' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rewrites models (defaulting context_window) and recalculates tiers when the api key is not touched', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'n' } as CustomProvider;
      const { svc, recalculate, upsertProvider, reloadPricing } = makeDeps({
        findOneResults: [existing],
      });
      await svc.update('agent-1', 'cp1', 'user-1', {
        models: [
          {
            model_name: 'm1',
            input_price_per_million_tokens: 1,
            output_price_per_million_tokens: 1,
          },
        ],
      });
      expect(existing.models[0].context_window).toBe(128_000);
      expect(recalculate).toHaveBeenCalledWith('agent-1');
      expect(upsertProvider).not.toHaveBeenCalled();
      // Edited prices must flow into the shared pricing cache so the next
      // proxied message picks up the new per-token cost.
      expect(reloadPricing).toHaveBeenCalledTimes(1);
    });

    it('retags auth_type via ProviderService.retagAuthType when a rename crosses the local ↔ api_key boundary', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'LM Studio' } as CustomProvider;
      const { svc, retagAuthType, upsertProvider, recalculate } = makeDeps({
        findOneResults: [existing, null],
      });
      await svc.update('agent-1', 'cp1', 'user-1', { name: 'My Home Server' });
      expect(retagAuthType).toHaveBeenCalledWith('agent-1', 'custom:cp1', 'api_key');
      // No apiKey in the DTO, so upsertProvider must not fire.
      expect(upsertProvider).not.toHaveBeenCalled();
      // retagAuthType owns the cache invalidation; rename should not double-recalculate tiers.
      expect(recalculate).not.toHaveBeenCalled();
    });

    it('retags local → api_key when renaming away from a canonical local name (LM Studio → Home Server)', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'LM Studio' } as CustomProvider;
      const { svc, retagAuthType } = makeDeps({ findOneResults: [existing, null] });
      await svc.update('agent-1', 'cp1', 'user-1', { name: 'Home Server' });
      expect(retagAuthType).toHaveBeenLastCalledWith('agent-1', 'custom:cp1', 'api_key');
    });

    it('retags api_key → local when renaming into a canonical local name', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'Home Server' } as CustomProvider;
      const { svc, retagAuthType } = makeDeps({ findOneResults: [existing, null] });
      await svc.update('agent-1', 'cp1', 'user-1', { name: 'LM Studio' });
      expect(retagAuthType).toHaveBeenLastCalledWith('agent-1', 'custom:cp1', 'local');
    });

    it('does not retag when a rename stays within the same category', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'Foo' } as CustomProvider;
      const { svc, retagAuthType } = makeDeps({ findOneResults: [existing, null] });
      await svc.update('agent-1', 'cp1', 'user-1', { name: 'Bar' });
      expect(retagAuthType).not.toHaveBeenCalled();
    });

    it('delegates tier recalculation to provider upsert when the api key is also updated', async () => {
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'n' } as CustomProvider;
      const { svc, recalculate, upsertProvider, reloadPricing } = makeDeps({
        findOneResults: [existing],
      });
      await svc.update('agent-1', 'cp1', 'user-1', {
        apiKey: 'sk-new',
        models: [
          {
            model_name: 'm1',
            input_price_per_million_tokens: 1,
            output_price_per_million_tokens: 1,
            context_window: 64_000,
          },
        ],
      });
      expect(upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'custom:cp1',
        'sk-new',
        'api_key',
      );
      // When api key is updated, the upsert triggers its own recalc — service should not double-call.
      expect(recalculate).not.toHaveBeenCalled();
      expect(existing.models[0].context_window).toBe(64_000);
      // Prices still changed → pricing cache must still be refreshed.
      expect(reloadPricing).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('throws NotFound when the provider is missing', async () => {
      const { svc } = makeDeps({ findOneResults: [null] });
      await expect(svc.remove('agent-1', 'cp1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes the row and attempts provider removal', async () => {
      const cp = { id: 'cp1', agent_id: 'agent-1' } as CustomProvider;
      const { svc, removeProvider, remove, reloadPricing } = makeDeps({ findOneResults: [cp] });
      await svc.remove('agent-1', 'cp1');
      expect(removeProvider).toHaveBeenCalledWith('agent-1', 'custom:cp1');
      expect(remove).toHaveBeenCalledWith(cp);
      // Stale pricing entries for this provider must be dropped from the
      // cache so getAll() stops returning them.
      expect(reloadPricing).toHaveBeenCalledTimes(1);
    });

    it('swallows errors from provider removal (partial-state cleanup)', async () => {
      const cp = { id: 'cp1', agent_id: 'agent-1' } as CustomProvider;
      const { svc, removeProvider, remove } = makeDeps({ findOneResults: [cp] });
      removeProvider.mockRejectedValue(new Error('not linked'));
      await expect(svc.remove('agent-1', 'cp1')).resolves.toBeUndefined();
      expect(remove).toHaveBeenCalledWith(cp);
    });
  });

  describe('getById', () => {
    it('returns the provider directly from the repository', async () => {
      const cp = { id: 'cp1' } as CustomProvider;
      const { svc, findOne } = makeDeps({ findOneResults: [cp] });
      await expect(svc.getById('cp1')).resolves.toBe(cp);
      expect(findOne).toHaveBeenCalledWith({ where: { id: 'cp1' } });
    });
  });

  describe('probeModels', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    const jsonResponse = (payload: unknown) =>
      ({
        ok: true,
        headers: {
          get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null),
        },
        json: async () => payload,
      }) as unknown as Response;

    it('returns the parsed model list on success', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: [{ id: 'm1' }, { id: 'm2' }] }),
        ) as unknown as typeof fetch;

      const result = await svc.probeModels('http://host.docker.internal:8000/v1', 'sk-x');
      expect(result).toEqual([{ model_name: 'm1' }, { model_name: 'm2' }]);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
        'http://host.docker.internal:8000/v1/models',
      );
      const init = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(init.headers.Authorization).toBe('Bearer sk-x');
      // Defense in depth: redirects must be rejected outright — otherwise
      // a hostile endpoint could 3xx the probe to a cloud-metadata URL
      // that would bypass the pre-fetch validator.
      expect(init.redirect).toBe('error');
    });

    it('strips trailing slashes from the base URL before appending /models', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonResponse({ data: [{ id: 'm1' }] })) as unknown as typeof fetch;

      await svc.probeModels('http://host.docker.internal:8000/v1///');
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
        'http://host.docker.internal:8000/v1/models',
      );
    });

    it('omits Authorization header when no apiKey is given', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonResponse({ data: [{ id: 'm1' }] })) as unknown as typeof fetch;

      await svc.probeModels('http://host.docker.internal:8000/v1');
      const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });

    it('returns an empty array when the server returns no models', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({})) as unknown as typeof fetch;

      const result = await svc.probeModels('http://host.docker.internal:8000/v1');
      expect(result).toEqual([]);
    });

    it('drops entries without a string id', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: [{ id: 'm1' }, { id: null }, {}, { id: '' }] }),
        ) as unknown as typeof fetch;

      const result = await svc.probeModels('http://host.docker.internal:8000/v1');
      expect(result).toEqual([{ model_name: 'm1' }]);
    });

    it('filters out embedding / reranker / moderation models (they cannot serve chat)', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          data: [
            { id: 'google/gemma-4-e4b' },
            { id: 'text-embedding-nomic-embed-text-v1.5' },
            { id: 'bge-reranker-base' },
            { id: 'openai/text-embedding-3-small' },
            { id: 'text-moderation-007' },
            { id: 'nomic-embed-text' },
          ],
        }),
      ) as unknown as typeof fetch;

      const result = await svc.probeModels('http://localhost:1234/v1');
      // Only the LLM survives; all embedders / rerankers / moderation models
      // are filtered out at probe time so they never reach the routing UI.
      expect(result).toEqual([{ model_name: 'google/gemma-4-e4b' }]);
    });

    it('returns an empty array when every returned model is an embedder (nothing routable)', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          data: [{ id: 'text-embedding-3-small' }, { id: 'nomic-embed-text-v1.5' }],
        }),
      ) as unknown as typeof fetch;

      const result = await svc.probeModels('http://localhost:1234/v1');
      expect(result).toEqual([]);
    });

    it('rejects non-JSON responses (HTML, binary, no content-type)', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html; charset=utf-8' },
        json: async () => ({ data: [] }),
      }) as unknown as typeof fetch;

      await expect(svc.probeModels('http://host.docker.internal:8000/v1')).rejects.toThrow(
        /instead of JSON/,
      );
    });

    it('rejects when the server omits the content-type header', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        json: async () => ({ data: [] }),
      }) as unknown as typeof fetch;

      await expect(svc.probeModels('http://host.docker.internal:8000/v1')).rejects.toThrow(
        /no content-type/,
      );
    });

    it('throws BadRequest when the URL fails validation', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(new Error('private or internal'));
      const { svc } = makeDeps({});
      await expect(svc.probeModels('http://127.0.0.1:11434/v1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequest when the server responds with a non-2xx status', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      }) as unknown as typeof fetch;

      await expect(svc.probeModels('http://host.docker.internal:8000/v1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequest when the fetch itself fails (e.g. ECONNREFUSED)', async () => {
      const { svc } = makeDeps({});
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
      await expect(svc.probeModels('http://host.docker.internal:8000/v1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('surfaces AbortError as a timeout-specific error message', async () => {
      const { svc } = makeDeps({});
      const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
      global.fetch = jest.fn().mockRejectedValue(abortErr) as unknown as typeof fetch;

      await expect(svc.probeModels('http://host.docker.internal:8000/v1')).rejects.toThrow(
        /No response from|loading a model/,
      );
    });

    it('aborts the request when the 5s timeout fires', async () => {
      const { svc } = makeDeps({});
      // Use a fake setTimeout that we can manually trigger. We can't rely
      // on jest.useFakeTimers() here because it doesn't cooperate cleanly
      // with the service's AbortController signal in async flows.
      const realSetTimeout = global.setTimeout;
      let fired: (() => void) | null = null;
      global.setTimeout = ((cb: () => void) => {
        fired = cb;
        return 0 as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout;

      try {
        // Hang the fetch until the abort signal fires so the service's
        // own timeout callback drives the failure path.
        global.fetch = jest.fn().mockImplementation((_url, init) => {
          return new Promise((_resolve, reject) => {
            (init as RequestInit).signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            });
          });
        }) as unknown as typeof fetch;

        const pending = svc.probeModels('http://host.docker.internal:8000/v1');
        // probeModels first awaits validatePublicUrl and only then calls
        // setTimeout — let the async prologue run before asserting our
        // fake setTimeout captured the callback.
        await new Promise((resolve) => realSetTimeout(resolve, 0));
        expect(fired).not.toBeNull();
        // Manually drive the AbortController.abort() callback registered
        // in probeModels so the timeout path is exercised end-to-end.
        fired!();
        await expect(pending).rejects.toThrow(/No response from|loading a model/);
      } finally {
        global.setTimeout = realSetTimeout;
      }
    });
  });
});
