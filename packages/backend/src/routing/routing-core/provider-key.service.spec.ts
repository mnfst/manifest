import { ProviderKeyService, SYNTHETIC_OLLAMA_PROVIDER_ID } from './provider-key.service';
import type { CachedProviderKey } from './routing-cache.service';

/**
 * Focused unit coverage for the key-selection projections. The proxy specs
 * mock ProviderKeyService wholesale, so these are the only place the real
 * selectProviderKey / getProviderKeyId / wrapper bodies run. getProviderKeys is
 * spied so the selection logic is exercised without the DB/decryption path.
 */
describe('ProviderKeyService — selection projections', () => {
  let svc: ProviderKeyService;

  beforeEach(() => {
    svc = new ProviderKeyService(
      {} as never, // providerRepo
      {} as never, // pricingCache
      {} as never, // discoveryService
      {} as never, // routingCache
      {} as never, // providerService
      null, // accessRepo (optional)
    );
  });

  const key = (over: Partial<CachedProviderKey>): CachedProviderKey => ({
    id: 'up-1',
    label: 'Default',
    priority: 0,
    apiKey: 'sk',
    region: null,
    ...over,
  });

  describe('selectProviderKey', () => {
    it('returns null when no keys resolve', async () => {
      jest.spyOn(svc, 'getProviderKeys').mockResolvedValue([]);
      expect(await svc.selectProviderKey('u', 'openai', 'api_key')).toBeNull();
    });

    it('matches the requested label case-insensitively', async () => {
      jest
        .spyOn(svc, 'getProviderKeys')
        .mockResolvedValue([
          key({ id: 'up-default', label: 'Default' }),
          key({ id: 'up-work', label: 'Work' }),
        ]);
      const sel = await svc.selectProviderKey('u', 'openai', 'api_key', 'work');
      expect(sel?.id).toBe('up-work');
    });

    it('falls back to the first key when the label does not match', async () => {
      jest
        .spyOn(svc, 'getProviderKeys')
        .mockResolvedValue([key({ id: 'up-default', label: 'Default' })]);
      const sel = await svc.selectProviderKey('u', 'openai', 'api_key', 'nonexistent');
      expect(sel?.id).toBe('up-default');
    });

    it('returns the first key when no label is given', async () => {
      jest
        .spyOn(svc, 'getProviderKeys')
        .mockResolvedValue([key({ id: 'up-default' }), key({ id: 'up-2', label: 'Two' })]);
      const sel = await svc.selectProviderKey('u', 'openai', 'api_key');
      expect(sel?.id).toBe('up-default');
    });
  });

  describe('getProviderKeyId', () => {
    it('returns the selected key id', async () => {
      jest.spyOn(svc, 'getProviderKeys').mockResolvedValue([key({ id: 'up-7' })]);
      expect(await svc.getProviderKeyId('u', 'openai', 'api_key')).toBe('up-7');
    });

    it('returns null for the synthetic Ollama key (no persisted row → would break the FK)', async () => {
      jest
        .spyOn(svc, 'getProviderKeys')
        .mockResolvedValue([key({ id: SYNTHETIC_OLLAMA_PROVIDER_ID, apiKey: '' })]);
      expect(await svc.getProviderKeyId('u', 'ollama', 'local')).toBeNull();
    });

    it('returns null when no key resolves', async () => {
      jest.spyOn(svc, 'getProviderKeys').mockResolvedValue([]);
      expect(await svc.getProviderKeyId('u', 'openai', 'api_key')).toBeNull();
    });
  });

  describe('getProviderApiKey / getProviderRegion projections', () => {
    it('getProviderApiKey returns the selected key apiKey', async () => {
      jest.spyOn(svc, 'getProviderKeys').mockResolvedValue([key({ apiKey: 'sk-x' })]);
      expect(await svc.getProviderApiKey('u', 'openai', 'api_key')).toBe('sk-x');
    });

    it('getProviderApiKey returns null when no key resolves', async () => {
      jest.spyOn(svc, 'getProviderKeys').mockResolvedValue([]);
      expect(await svc.getProviderApiKey('u', 'openai', 'api_key')).toBeNull();
    });

    it('getProviderRegion returns the selected key region', async () => {
      jest.spyOn(svc, 'getProviderKeys').mockResolvedValue([key({ region: 'eu-west' })]);
      expect(await svc.getProviderRegion('u', 'openai', 'api_key')).toBe('eu-west');
    });

    it('getProviderRegion returns null when no key resolves', async () => {
      jest.spyOn(svc, 'getProviderKeys').mockResolvedValue([]);
      expect(await svc.getProviderRegion('u', 'openai', 'api_key')).toBeNull();
    });
  });
});
