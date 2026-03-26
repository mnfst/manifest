import { TIERS, TIER_LABELS, TIER_DESCRIPTIONS, Tier } from '../src/tiers';

describe('TIERS', () => {
  it('contains exactly four tier values', () => {
    expect(TIERS).toEqual(['simple', 'standard', 'complex', 'reasoning']);
  });

  it('has exactly four entries', () => {
    expect(TIERS).toHaveLength(4);
  });
});

describe('TIER_LABELS', () => {
  it('maps every tier to a capitalized label', () => {
    expect(TIER_LABELS.simple).toBe('Simple');
    expect(TIER_LABELS.standard).toBe('Standard');
    expect(TIER_LABELS.complex).toBe('Complex');
    expect(TIER_LABELS.reasoning).toBe('Reasoning');
  });

  it('has an entry for every tier', () => {
    for (const tier of TIERS) {
      expect(TIER_LABELS[tier]).toBeDefined();
    }
  });
});

describe('TIER_DESCRIPTIONS', () => {
  it('has a non-empty description for every tier', () => {
    for (const tier of TIERS) {
      expect(TIER_DESCRIPTIONS[tier]).toBeDefined();
      expect(TIER_DESCRIPTIONS[tier].length).toBeGreaterThan(0);
    }
  });
});

describe('Tier type', () => {
  it('accepts valid tier values', () => {
    const validTiers: Tier[] = ['simple', 'standard', 'complex', 'reasoning'];
    expect(validTiers).toHaveLength(4);
  });
});
