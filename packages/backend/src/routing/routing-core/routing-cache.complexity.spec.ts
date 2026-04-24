import { RoutingCacheService } from './routing-cache.service';

describe('RoutingCacheService — complexity flag cache', () => {
  let cache: RoutingCacheService;

  beforeEach(() => {
    cache = new RoutingCacheService();
  });

  it('returns undefined when nothing is cached', () => {
    expect(cache.getComplexityEnabled('agent-1')).toBeUndefined();
  });

  it('stores and reads back a boolean', () => {
    cache.setComplexityEnabled('agent-1', true);
    expect(cache.getComplexityEnabled('agent-1')).toBe(true);
    cache.setComplexityEnabled('agent-1', false);
    expect(cache.getComplexityEnabled('agent-1')).toBe(false);
  });

  it('invalidateAgent drops the cached flag', () => {
    cache.setComplexityEnabled('agent-1', true);
    cache.invalidateAgent('agent-1');
    expect(cache.getComplexityEnabled('agent-1')).toBeUndefined();
  });
});
