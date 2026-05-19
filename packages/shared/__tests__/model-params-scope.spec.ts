import {
  modelParamsScopeForHeaderTier,
  modelParamsScopeForRouting,
  modelParamsScopeForSpecificity,
  modelParamsScopeForTier,
} from '../src/model-params-scope';

describe('model params scope helpers', () => {
  it('builds explicit scope keys for each routing surface', () => {
    expect(modelParamsScopeForTier('simple')).toBe('tier:simple');
    expect(modelParamsScopeForSpecificity('coding')).toBe('specificity:coding');
    expect(modelParamsScopeForHeaderTier('header-1')).toBe('header:header-1');
  });

  it('chooses the most specific route scope from resolved routing metadata', () => {
    expect(
      modelParamsScopeForRouting({
        tier: 'standard',
        specificityCategory: 'coding',
        headerTierId: 'header-1',
      }),
    ).toBe('header:header-1');
    expect(modelParamsScopeForRouting({ tier: 'standard', specificityCategory: 'coding' })).toBe(
      'specificity:coding',
    );
    expect(modelParamsScopeForRouting({ tier: 'standard' })).toBe('tier:standard');
  });
});
