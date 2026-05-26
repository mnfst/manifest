import { KiroOauthService } from './kiro-oauth.service';
import { ProviderService } from '../routing-core/provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import {
  getFreshKiroCliToken,
  parseKiroCliTokenBlob,
  serializeKiroCliTokenBlob,
  type KiroCliTokenBlob,
} from './kiro-cli-token';

jest.mock('./kiro-cli-token', () => ({
  getFreshKiroCliToken: jest.fn(),
  parseKiroCliTokenBlob: jest.fn(),
  serializeKiroCliTokenBlob: jest.fn((blob: KiroCliTokenBlob) => JSON.stringify(blob)),
}));

describe('KiroOauthService', () => {
  let providerService: jest.Mocked<ProviderService>;
  let discoveryService: jest.Mocked<ModelDiscoveryService>;
  let service: KiroOauthService;
  const token: KiroCliTokenBlob = {
    source: 'kiro-cli',
    t: 'access-token',
    r: 'refresh-token',
    e: Date.parse('2026-05-26T08:33:56Z'),
    authMethod: 'social',
    provider: 'github',
    profileArn: 'profile-arn',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-26T08:00:00Z'));
    jest.clearAllMocks();
    jest.mocked(getFreshKiroCliToken).mockResolvedValue(token);
    jest.mocked(parseKiroCliTokenBlob).mockReturnValue(null);
    providerService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: { id: 'provider-1' } }),
      recalculateTiers: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProviderService>;
    discoveryService = {
      discoverModels: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ModelDiscoveryService>;
    service = new KiroOauthService(providerService, discoveryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('connects from the local Kiro CLI token cache and triggers discovery', async () => {
    const result = await service.connectFromCli('agent-1', 'user-1');

    expect(providerService.upsertProvider).toHaveBeenCalledWith(
      'agent-1',
      'user-1',
      'kiro',
      JSON.stringify(token),
      'subscription',
    );
    expect(discoveryService.discoverModels).toHaveBeenCalledWith({ id: 'provider-1' });
    expect(providerService.recalculateTiers).toHaveBeenCalledWith('agent-1');
    expect(result).toEqual({
      ok: true,
      expiresAt: '2026-05-26T08:33:56.000Z',
      authMethod: 'social',
      provider: 'github',
    });
  });

  it('keeps the CLI connection when post-connect discovery fails', async () => {
    discoveryService.discoverModels.mockRejectedValue(new Error('discovery failed'));

    const result = await service.connectFromCli('agent-1', 'user-1');

    expect(result.ok).toBe(true);
    expect(providerService.recalculateTiers).not.toHaveBeenCalled();
  });

  it('returns a fresh parsed access token without refreshing', async () => {
    jest.mocked(parseKiroCliTokenBlob).mockReturnValue({
      source: 'kiro-cli',
      t: 'stored-access',
      e: Date.parse('2026-05-26T08:10:00Z'),
    });

    const result = await service.unwrapToken('blob', 'agent-1', 'user-1');

    expect(result).toBe('stored-access');
    expect(getFreshKiroCliToken).not.toHaveBeenCalled();
  });

  it('refreshes expired Kiro CLI blobs and persists the replacement', async () => {
    jest.mocked(parseKiroCliTokenBlob).mockReturnValue({
      source: 'kiro-cli',
      t: 'expired-access',
      e: Date.parse('2026-05-26T07:59:00Z'),
    });

    const result = await service.unwrapToken('blob', 'agent-1', 'user-1');

    expect(result).toBe('access-token');
    expect(providerService.upsertProvider).toHaveBeenCalledWith(
      'agent-1',
      'user-1',
      'kiro',
      JSON.stringify(token),
      'subscription',
    );
  });

  it('falls back to the stored Kiro CLI token when refresh fails before hard expiry', async () => {
    jest.mocked(parseKiroCliTokenBlob).mockReturnValue({
      source: 'kiro-cli',
      t: 'stored-access',
      e: Date.parse('2026-05-26T08:00:30Z'),
    });
    jest.mocked(getFreshKiroCliToken).mockRejectedValue(new Error('refresh failed'));

    const result = await service.unwrapToken('blob', 'agent-1', 'user-1');

    expect(result).toBe('stored-access');
  });

  it('returns null when an expired Kiro CLI token cannot refresh', async () => {
    jest.mocked(parseKiroCliTokenBlob).mockReturnValue({
      source: 'kiro-cli',
      t: 'expired-access',
      e: Date.parse('2026-05-26T07:59:00Z'),
    });
    jest.mocked(getFreshKiroCliToken).mockRejectedValue(new Error('refresh failed'));

    const result = await service.unwrapToken('blob', 'agent-1', 'user-1');

    expect(result).toBeNull();
  });

  it('returns null for non-Kiro blobs', async () => {
    expect(await service.unwrapToken('plain-key', 'agent-1', 'user-1')).toBeNull();
  });
});
