import { SessionMomentumService } from '../session-momentum.service';

describe('SessionMomentumService', () => {
  let service: SessionMomentumService;

  beforeEach(() => {
    service = new SessionMomentumService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('returns undefined for unknown session', () => {
    expect(service.getRecentTiers('unknown')).toBeUndefined();
  });

  it('records and retrieves a tier', () => {
    service.recordTier('sess-1', 'complex');
    expect(service.getRecentTiers('sess-1')).toEqual(['complex']);
  });

  it('prepends new tiers (most recent first)', () => {
    service.recordTier('sess-1', 'simple');
    service.recordTier('sess-1', 'complex');
    service.recordTier('sess-1', 'reasoning');
    expect(service.getRecentTiers('sess-1')).toEqual([
      'reasoning',
      'complex',
      'simple',
    ]);
  });

  it('caps at 5 entries', () => {
    for (const tier of ['simple', 'standard', 'complex', 'reasoning', 'simple', 'complex'] as const) {
      service.recordTier('sess-1', tier);
    }
    const tiers = service.getRecentTiers('sess-1')!;
    expect(tiers).toHaveLength(5);
    expect(tiers[0]).toBe('complex');
  });

  it('returns undefined for expired sessions', () => {
    service.recordTier('sess-1', 'simple');

    // Manually expire by reaching into the internals
    const sessions = (service as unknown as { sessions: Map<string, { lastUpdated: number }> }).sessions;
    const entry = sessions.get('sess-1')!;
    entry.lastUpdated = Date.now() - 31 * 60 * 1000; // 31 minutes ago

    expect(service.getRecentTiers('sess-1')).toBeUndefined();
  });

  it('isolates different session keys', () => {
    service.recordTier('a', 'simple');
    service.recordTier('b', 'complex');
    expect(service.getRecentTiers('a')).toEqual(['simple']);
    expect(service.getRecentTiers('b')).toEqual(['complex']);
  });
});
