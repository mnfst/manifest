import {
  modelParamsScopeForTier,
  modelParamsScopeForSpecificity,
  modelParamsScopeForHeaderTier,
  modelParamsScopeForRouting,
} from '../src/model-params-scope';

describe('modelParamsScopeForTier', () => {
  it('prefixes the tier', () => {
    expect(modelParamsScopeForTier('complex')).toBe('tier:complex');
  });
});

describe('modelParamsScopeForSpecificity', () => {
  it('prefixes the specificity category', () => {
    expect(modelParamsScopeForSpecificity('coding')).toBe('specificity:coding');
  });
});

describe('modelParamsScopeForHeaderTier', () => {
  it('prefixes the header tier id', () => {
    expect(modelParamsScopeForHeaderTier('abc-123')).toBe('header:abc-123');
  });
});

describe('modelParamsScopeForRouting', () => {
  it('prefers the header tier when present', () => {
    expect(
      modelParamsScopeForRouting({
        tier: 'standard',
        specificityCategory: 'coding',
        headerTierId: 'h1',
      }),
    ).toBe('header:h1');
  });

  it('falls back to specificity when no header tier', () => {
    expect(
      modelParamsScopeForRouting({
        tier: 'standard',
        specificityCategory: 'trading',
      }),
    ).toBe('specificity:trading');
  });

  it('falls back to the complexity tier when neither header nor specificity is set', () => {
    expect(modelParamsScopeForRouting({ tier: 'simple' })).toBe('tier:simple');
  });
});
