// Edge-case coverage for CustomProviderService. Lives alongside the main
// spec to keep individual files under the 300-line limit. Focuses on
// scenarios that the broader spec doesn't already pin down:
//   - cache-eviction races where a custom provider reference outlives the
//     custom_providers row
//   - URL-validation failure surfaces propagating through every entry
//     point (create / update / probeModels) for malformed URLs, http-in-
//     cloud-mode rejections, and private-IP rejections
jest.mock('../../common/utils/url-validation', () => ({
  validatePublicUrl: jest.fn(),
}));
jest.mock('../../common/utils/detect-self-hosted', () => ({
  isSelfHosted: jest.fn().mockReturnValue(false),
}));

import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CustomProviderService } from './custom-provider.service';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ProviderService } from '../routing-core/provider.service';
import { RoutingCacheService } from '../routing-core/routing-cache.service';
import { TierAutoAssignService } from '../routing-core/tier-auto-assign.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ModelsDevSyncService } from '../../database/models-dev-sync.service';
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
  const providerService = {
    upsertProvider: jest.fn().mockResolvedValue({ provider: {} }),
    removeProvider: jest.fn().mockResolvedValue(undefined),
    retagAuthType: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProviderService;
  const getCustomProviders = jest.fn().mockReturnValue(overrides.cached ?? null);
  const setCustomProviders = jest.fn();
  const routingCache = {
    getCustomProviders,
    setCustomProviders,
    invalidateAgent: jest.fn(),
  } as unknown as RoutingCacheService;
  const autoAssign = {
    recalculate: jest.fn().mockResolvedValue(undefined),
  } as unknown as TierAutoAssignService;
  const pricingCache = {
    reload: jest.fn().mockResolvedValue(undefined),
  } as unknown as ModelPricingCacheService;

  const svc = new CustomProviderService(
    repo,
    providerService,
    routingCache,
    autoAssign,
    pricingCache,
    undefined as unknown as ModelsDevSyncService,
  );

  return { svc, find, findOne, getCustomProviders, setCustomProviders };
}

describe('CustomProviderService edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validatePublicUrl as jest.Mock).mockReset();
    (validatePublicUrl as jest.Mock).mockResolvedValue(undefined);
    (isSelfHosted as jest.Mock).mockReset();
    (isSelfHosted as jest.Mock).mockReturnValue(false);
  });

  describe('canonicalizeAgentMessageKeys with stale references', () => {
    it('handles a true cache miss (cache null + DB empty) by falling through to passthrough', async () => {
      // Distinct from `cached: []`: the cache itself returned no entry at all
      // (e.g. just after `invalidateAgent`), so list() has to hit the DB.
      // The DB also returns nothing — the provider was deleted from under
      // a still-pending message. The canonicalizer must pass the keys
      // through untouched rather than throw or invent canonical names.
      const { svc, find, setCustomProviders } = makeDeps({
        cached: null,
        findResult: [],
      });

      const result = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        'custom:deleted-uuid',
        'custom:deleted-uuid/some-model',
      );

      expect(result).toEqual({
        provider: 'custom:deleted-uuid',
        model: 'custom:deleted-uuid/some-model',
      });
      // The cache miss path must actually hit the DB and repopulate the
      // cache (with the empty result) so the next lookup is also cheap.
      expect(find).toHaveBeenCalledWith({ where: { agent_id: 'agent-1' } });
      expect(setCustomProviders).toHaveBeenCalledWith('agent-1', []);
    });

    it('passes through when cache miss + DB has unrelated providers (UUID still gone)', async () => {
      // Cache cold, DB has *other* custom providers for the agent but not
      // the one being canonicalized. This is the realistic stale-pointer
      // case after a delete + invalidateAgent.
      const otherRow = {
        id: 'cp-still-here',
        agent_id: 'agent-1',
        name: 'llama.cpp',
      } as CustomProvider;
      const { svc } = makeDeps({
        cached: null,
        findResult: [otherRow],
      });

      const result = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        'custom:deleted-uuid',
        'custom:deleted-uuid/foo',
      );

      // Other providers in the result must not bleed onto the deleted ID.
      expect(result).toEqual({
        provider: 'custom:deleted-uuid',
        model: 'custom:deleted-uuid/foo',
      });
    });

    it('passes through fallback_from_model when cache miss + DB empty (null provider)', async () => {
      // fallback_from_model branch (provider null, model carries custom:
      // prefix) under a true cache miss. Same passthrough contract.
      const { svc, find } = makeDeps({
        cached: null,
        findResult: [],
      });

      const result = await svc.canonicalizeAgentMessageKeys(
        'agent-1',
        null,
        'custom:evicted/legacy-model',
      );

      expect(result).toEqual({ provider: null, model: 'custom:evicted/legacy-model' });
      expect(find).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL validation failures', () => {
    const baseDto = {
      name: 'my-provider',
      base_url: 'http://bad.example',
      apiKey: 'sk-x',
      models: [
        {
          model_name: 'm1',
          input_price_per_million_tokens: 1,
          output_price_per_million_tokens: 1,
        },
      ],
    };

    it('rejects malformed URLs on create with BadRequestException carrying the validator message', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(new Error('Invalid URL format'));
      const { svc } = makeDeps({ findOneResults: [null] });
      // The service must wrap whatever the validator throws in a
      // BadRequestException — leaking the raw Error type would surface as
      // a 500 to the client, hiding the underlying user-input problem.
      await expect(svc.create('agent-1', 'user-1', baseDto)).rejects.toThrow(BadRequestException);
      await expect(svc.create('agent-1', 'user-1', baseDto)).rejects.toThrow(/Invalid URL format/);
    });

    it('rejects http URLs in cloud mode on create (cleartext credentials risk)', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(
        new Error('Only https URLs are allowed in cloud mode.'),
      );
      const { svc } = makeDeps({ findOneResults: [null] });
      await expect(
        svc.create('agent-1', 'user-1', { ...baseDto, base_url: 'http://api.example.com' }),
      ).rejects.toThrow(/Only https URLs are allowed/);
      // allowPrivate must be false in non-self-hosted runs — the validator
      // can't make that decision on its own without this option.
      expect(validatePublicUrl).toHaveBeenLastCalledWith('http://api.example.com', {
        allowPrivate: false,
      });
    });

    it('rejects private-IP URLs in cloud mode on create (SSRF guard)', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(
        new Error('URLs pointing to private or internal networks are not allowed'),
      );
      const { svc } = makeDeps({ findOneResults: [null] });
      await expect(
        svc.create('agent-1', 'user-1', { ...baseDto, base_url: 'http://10.0.0.5:11434' }),
      ).rejects.toThrow(/private or internal networks/);
    });

    it('rejects cloud-metadata URLs on create even in self-hosted mode', async () => {
      // Cloud metadata is the one destination that's always blocked, even
      // when allowPrivate is on — the validator throws and the service
      // must still wrap it as a BadRequestException.
      (isSelfHosted as jest.Mock).mockReturnValue(true);
      (validatePublicUrl as jest.Mock).mockRejectedValue(
        new Error('URLs pointing to cloud metadata endpoints are not allowed'),
      );
      const { svc } = makeDeps({ findOneResults: [null] });
      await expect(
        svc.create('agent-1', 'user-1', {
          ...baseDto,
          base_url: 'http://169.254.169.254/latest/meta-data',
        }),
      ).rejects.toThrow(/cloud metadata endpoints/);
      expect(validatePublicUrl).toHaveBeenLastCalledWith(
        'http://169.254.169.254/latest/meta-data',
        { allowPrivate: true },
      );
    });

    it('rejects malformed URLs on update with BadRequestException', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(new Error('Invalid URL format'));
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'n' } as CustomProvider;
      const { svc } = makeDeps({ findOneResults: [existing] });
      await expect(
        svc.update('agent-1', 'cp1', 'user-1', { base_url: 'ht!tp://broken' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects private-IP URLs on update in cloud mode', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(
        new Error('URLs pointing to private or internal networks are not allowed'),
      );
      const existing = { id: 'cp1', agent_id: 'agent-1', name: 'n' } as CustomProvider;
      const { svc } = makeDeps({ findOneResults: [existing] });
      await expect(
        svc.update('agent-1', 'cp1', 'user-1', { base_url: 'http://192.168.1.10' }),
      ).rejects.toThrow(/private or internal networks/);
    });

    it('propagates malformed URL errors from probeModels as BadRequestException', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(new Error('Invalid URL format'));
      const { svc } = makeDeps({});
      await expect(svc.probeModels('not a url')).rejects.toThrow(BadRequestException);
      await expect(svc.probeModels('not a url')).rejects.toThrow(/Invalid URL format/);
    });

    it('propagates cloud-metadata rejection from probeModels (SSRF defense in depth)', async () => {
      (validatePublicUrl as jest.Mock).mockRejectedValue(
        new Error('URLs pointing to cloud metadata endpoints are not allowed'),
      );
      const { svc } = makeDeps({});
      await expect(svc.probeModels('http://169.254.169.254')).rejects.toThrow(BadRequestException);
      await expect(svc.probeModels('http://169.254.169.254')).rejects.toThrow(
        /cloud metadata endpoints/,
      );
    });

    it('passes allowPrivate=true to probeModels in self-hosted mode but still blocks bad URLs', async () => {
      (isSelfHosted as jest.Mock).mockReturnValue(true);
      (validatePublicUrl as jest.Mock).mockRejectedValue(
        new Error('Only http and https URLs are allowed'),
      );
      const { svc } = makeDeps({});
      await expect(svc.probeModels('ftp://internal.host/v1')).rejects.toThrow(BadRequestException);
      expect(validatePublicUrl).toHaveBeenLastCalledWith('ftp://internal.host/v1', {
        allowPrivate: true,
      });
    });
  });
});
