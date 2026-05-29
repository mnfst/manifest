import {
  aliasToSpecificityCategory,
  classifyModelAlias,
  getValidAliases,
  specificityCategoryToAlias,
} from '../src/model-alias';
import { SPECIFICITY_CATEGORIES } from '../src/specificity';
import { TIER_SLOTS } from '../src/tiers';

describe('specificityCategoryToAlias', () => {
  it('converts underscores to hyphens', () => {
    expect(specificityCategoryToAlias('web_browsing')).toBe('web-browsing');
    expect(specificityCategoryToAlias('data_analysis')).toBe('data-analysis');
  });

  it('leaves single-word categories unchanged', () => {
    expect(specificityCategoryToAlias('coding')).toBe('coding');
  });
});

describe('aliasToSpecificityCategory', () => {
  it('accepts kebab-case aliases', () => {
    expect(aliasToSpecificityCategory('web-browsing')).toBe('web_browsing');
  });

  it('accepts legacy snake_case aliases', () => {
    expect(aliasToSpecificityCategory('web_browsing')).toBe('web_browsing');
  });

  it('returns null for unknown aliases', () => {
    expect(aliasToSpecificityCategory('web-browse')).toBeNull();
  });
});

describe('classifyModelAlias', () => {
  it('classifies auto', () => {
    expect(classifyModelAlias('auto')).toEqual({ kind: 'auto' });
  });

  it.each(TIER_SLOTS)('classifies tier slot %s', (tier) => {
    expect(classifyModelAlias(tier)).toEqual({ kind: 'tier', tier });
  });

  it('classifies kebab-case specificity aliases', () => {
    expect(classifyModelAlias('web-browsing')).toEqual({
      kind: 'specificity',
      category: 'web_browsing',
    });
    expect(classifyModelAlias('data-analysis')).toEqual({
      kind: 'specificity',
      category: 'data_analysis',
    });
  });

  it('still classifies snake_case specificity aliases', () => {
    expect(classifyModelAlias('web_browsing')).toEqual({
      kind: 'specificity',
      category: 'web_browsing',
    });
  });

  it.each(SPECIFICITY_CATEGORIES.filter((c) => !c.includes('_')))(
    'classifies single-word specificity category %s',
    (category) => {
      expect(classifyModelAlias(category)).toEqual({ kind: 'specificity', category });
    },
  );

  it('returns null for unrecognized values', () => {
    expect(classifyModelAlias('banana')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(classifyModelAlias('')).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(classifyModelAlias(null)).toBeNull();
    expect(classifyModelAlias(undefined)).toBeNull();
  });

  it('is case-sensitive', () => {
    expect(classifyModelAlias('Simple')).toBeNull();
    expect(classifyModelAlias('Web-Browsing')).toBeNull();
    expect(classifyModelAlias('AUTO')).toBeNull();
  });
});

describe('getValidAliases', () => {
  it('returns auto, tier slots, and kebab-case specificity aliases', () => {
    expect(getValidAliases()).toEqual([
      'auto',
      ...TIER_SLOTS,
      ...SPECIFICITY_CATEGORIES.map(specificityCategoryToAlias),
    ]);
  });
});
