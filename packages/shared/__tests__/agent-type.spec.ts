import {
  AGENT_CATEGORIES,
  AGENT_PLATFORMS,
  CATEGORY_LABELS,
  PLATFORM_LABELS,
  PLATFORMS_BY_CATEGORY,
  PLATFORM_ICONS,
  platformIcon,
} from '../src/agent-type';

describe('agent-type', () => {
  it('exposes the full set of categories and platforms', () => {
    expect(AGENT_CATEGORIES).toEqual(['personal', 'app']);
    expect(AGENT_PLATFORMS).toEqual([
      'openclaw',
      'hermes',
      'openai-sdk',
      'vercel-ai-sdk',
      'langchain',
      'curl',
      'other',
    ]);
  });

  it('provides a human label for every category and platform', () => {
    for (const category of AGENT_CATEGORIES) {
      expect(typeof CATEGORY_LABELS[category]).toBe('string');
    }
    for (const platform of AGENT_PLATFORMS) {
      expect(typeof PLATFORM_LABELS[platform]).toBe('string');
    }
  });

  it('maps every category to a non-empty list of platforms that are all registered', () => {
    for (const category of AGENT_CATEGORIES) {
      const platforms = PLATFORMS_BY_CATEGORY[category];
      expect(platforms.length).toBeGreaterThan(0);
      for (const platform of platforms) {
        expect(AGENT_PLATFORMS).toContain(platform);
      }
    }
  });

  describe('platformIcon', () => {
    it('returns undefined for missing input', () => {
      expect(platformIcon(null, null)).toBeUndefined();
      expect(platformIcon(undefined, 'personal')).toBeUndefined();
      expect(platformIcon('', 'personal')).toBeUndefined();
    });

    it('returns the personal-agent icon for "other" in the personal category', () => {
      expect(platformIcon('other', 'personal')).toBe('/icons/other-agent.svg');
    });

    it('returns the generic "other" icon for "other" in the app category (or unknown)', () => {
      expect(platformIcon('other', 'app')).toBe('/icons/other.svg');
      expect(platformIcon('other', null)).toBe('/icons/other.svg');
      expect(platformIcon('other', undefined)).toBe('/icons/other.svg');
    });

    it('returns the registered icon for known platforms', () => {
      expect(platformIcon('openclaw', 'personal')).toBe(PLATFORM_ICONS.openclaw);
      expect(platformIcon('hermes', 'personal')).toBe(PLATFORM_ICONS.hermes);
      expect(platformIcon('openai-sdk', 'app')).toBe(PLATFORM_ICONS['openai-sdk']);
      expect(platformIcon('vercel-ai-sdk', 'app')).toBe(PLATFORM_ICONS['vercel-ai-sdk']);
      expect(platformIcon('langchain', 'app')).toBe(PLATFORM_ICONS.langchain);
    });

    it('returns undefined for platforms with no registered icon', () => {
      expect(platformIcon('curl', 'app')).toBeUndefined();
    });

    it('returns undefined for unknown platform strings (no injection via string)', () => {
      expect(platformIcon('not-a-real-platform', 'personal')).toBeUndefined();
    });
  });
});
