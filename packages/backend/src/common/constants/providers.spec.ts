import {
  PROVIDER_REGISTRY,
  PROVIDER_BY_ID,
  PROVIDER_BY_ID_OR_ALIAS,
  OPENROUTER_PREFIX_TO_PROVIDER,
  ALL_PROVIDER_IDS,
  expandProviderNames,
  ProviderRegistryEntry,
} from './providers';

describe('PROVIDER_REGISTRY', () => {
  it('should contain exactly 14 provider entries', () => {
    expect(PROVIDER_REGISTRY).toHaveLength(14);
  });

  it('ollama-cloud has localOnly=false and requiresApiKey=false', () => {
    const cloud = PROVIDER_REGISTRY.find((p) => p.id === 'ollama-cloud');
    expect(cloud).toBeDefined();
    expect(cloud!.displayName).toBe('Ollama Cloud');
    expect(cloud!.localOnly).toBe(false);
    expect(cloud!.requiresApiKey).toBe(false);
    expect(cloud!.aliases).toEqual([]);
    expect(cloud!.openRouterPrefixes).toEqual([]);
  });

  it('every entry has all required fields', () => {
    for (const entry of PROVIDER_REGISTRY) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.displayName).toBe('string');
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.aliases)).toBe(true);
      expect(Array.isArray(entry.openRouterPrefixes)).toBe(true);
      expect(typeof entry.requiresApiKey).toBe('boolean');
      expect(typeof entry.localOnly).toBe('boolean');
    }
  });

  it('has no duplicate provider IDs', () => {
    const ids = PROVIDER_REGISTRY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no alias that resolves to multiple different providers', () => {
    const aliasToProvider: Map<string, string> = new Map();
    for (const entry of PROVIDER_REGISTRY) {
      for (const alias of entry.aliases) {
        expect(aliasToProvider.has(alias)).toBe(false);
        aliasToProvider.set(alias, entry.id);
      }
    }
  });

  it('ollama has localOnly=true and requiresApiKey=false', () => {
    const ollama = PROVIDER_REGISTRY.find((p) => p.id === 'ollama');
    expect(ollama).toBeDefined();
    expect(ollama!.localOnly).toBe(true);
    expect(ollama!.requiresApiKey).toBe(false);
  });

  it('openrouter has requiresApiKey=true', () => {
    const openrouter = PROVIDER_REGISTRY.find((p) => p.id === 'openrouter');
    expect(openrouter).toBeDefined();
    expect(openrouter!.requiresApiKey).toBe(true);
  });

  it('anthropic has no aliases', () => {
    const anthropic = PROVIDER_REGISTRY.find((p) => p.id === 'anthropic');
    expect(anthropic).toBeDefined();
    expect(anthropic!.aliases).toEqual([]);
  });

  it('copilot has requiresApiKey=false and localOnly=false', () => {
    const copilot = PROVIDER_REGISTRY.find((p) => p.id === 'copilot');
    expect(copilot).toBeDefined();
    expect(copilot!.displayName).toBe('GitHub Copilot');
    expect(copilot!.requiresApiKey).toBe(false);
    expect(copilot!.localOnly).toBe(false);
    expect(copilot!.aliases).toEqual([]);
    expect(copilot!.openRouterPrefixes).toEqual([]);
  });
});

describe('PROVIDER_BY_ID', () => {
  it('resolves all 14 provider IDs', () => {
    for (const entry of PROVIDER_REGISTRY) {
      expect(PROVIDER_BY_ID.get(entry.id)).toBe(entry);
    }
    expect(PROVIDER_BY_ID.size).toBe(14);
  });

  it('returns undefined for an unknown ID', () => {
    expect(PROVIDER_BY_ID.get('nonexistent')).toBeUndefined();
  });
});

describe('PROVIDER_BY_ID_OR_ALIAS', () => {
  it('resolves every provider ID', () => {
    for (const entry of PROVIDER_REGISTRY) {
      expect(PROVIDER_BY_ID_OR_ALIAS.get(entry.id)).toBe(entry);
    }
  });

  it('resolves google alias to gemini entry', () => {
    const entry = PROVIDER_BY_ID_OR_ALIAS.get('google') as ProviderRegistryEntry;
    expect(entry).toBeDefined();
    expect(entry.id).toBe('gemini');
    expect(entry.displayName).toBe('Google');
  });

  it('resolves alibaba alias to qwen entry', () => {
    const entry = PROVIDER_BY_ID_OR_ALIAS.get('alibaba') as ProviderRegistryEntry;
    expect(entry).toBeDefined();
    expect(entry.id).toBe('qwen');
    expect(entry.displayName).toBe('Alibaba');
  });

  it('resolves kimi alias to moonshot entry', () => {
    const entry = PROVIDER_BY_ID_OR_ALIAS.get('kimi') as ProviderRegistryEntry;
    expect(entry).toBeDefined();
    expect(entry.id).toBe('moonshot');
  });

  it('resolves z.ai alias to zai entry', () => {
    const entry = PROVIDER_BY_ID_OR_ALIAS.get('z.ai') as ProviderRegistryEntry;
    expect(entry).toBeDefined();
    expect(entry.id).toBe('zai');
    expect(entry.displayName).toBe('Z.ai');
  });

  it('returns undefined for an unknown alias', () => {
    expect(PROVIDER_BY_ID_OR_ALIAS.get('nonexistent')).toBeUndefined();
  });
});

describe('OPENROUTER_PREFIX_TO_PROVIDER', () => {
  it('maps every openRouterPrefix to its provider displayName', () => {
    for (const entry of PROVIDER_REGISTRY) {
      for (const prefix of entry.openRouterPrefixes) {
        expect(OPENROUTER_PREFIX_TO_PROVIDER.get(prefix)).toBe(entry.displayName);
      }
    }
  });

  it('total size equals the total number of openRouterPrefixes across all entries', () => {
    const totalPrefixes = PROVIDER_REGISTRY.reduce(
      (sum, p) => sum + p.openRouterPrefixes.length,
      0,
    );
    expect(OPENROUTER_PREFIX_TO_PROVIDER.size).toBe(totalPrefixes);
  });

  it('maps xai and x-ai prefixes to xAI', () => {
    expect(OPENROUTER_PREFIX_TO_PROVIDER.get('xai')).toBe('xAI');
    expect(OPENROUTER_PREFIX_TO_PROVIDER.get('x-ai')).toBe('xAI');
  });

  it('returns undefined for an unknown prefix', () => {
    expect(OPENROUTER_PREFIX_TO_PROVIDER.get('unknown-vendor')).toBeUndefined();
  });
});

describe('ALL_PROVIDER_IDS', () => {
  it('includes all provider IDs', () => {
    for (const entry of PROVIDER_REGISTRY) {
      expect(ALL_PROVIDER_IDS.has(entry.id)).toBe(true);
    }
  });

  it('includes all aliases', () => {
    for (const entry of PROVIDER_REGISTRY) {
      for (const alias of entry.aliases) {
        expect(ALL_PROVIDER_IDS.has(alias)).toBe(true);
      }
    }
  });

  it('has size equal to the count of all IDs plus aliases', () => {
    const expected = PROVIDER_REGISTRY.reduce((sum, p) => sum + 1 + p.aliases.length, 0);
    expect(ALL_PROVIDER_IDS.size).toBe(expected);
  });
});

describe('expandProviderNames', () => {
  it('should expand a provider ID to include its aliases', () => {
    const result = expandProviderNames(['gemini']);
    expect(result.has('gemini')).toBe(true);
    expect(result.has('google')).toBe(true);
  });

  it('should expand an alias to include the canonical ID and all sibling aliases', () => {
    const result = expandProviderNames(['google']);
    expect(result.has('google')).toBe(true);
    expect(result.has('gemini')).toBe(true);
  });

  it('should expand moonshot and kimi alias bidirectionally', () => {
    const fromId = expandProviderNames(['moonshot']);
    expect(fromId.has('moonshot')).toBe(true);
    expect(fromId.has('kimi')).toBe(true);

    const fromAlias = expandProviderNames(['kimi']);
    expect(fromAlias.has('moonshot')).toBe(true);
    expect(fromAlias.has('kimi')).toBe(true);
  });

  it('should not expand custom: prefixed names', () => {
    const result = expandProviderNames(['custom:my-provider']);
    expect(result.has('custom:my-provider')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should lowercase the input names', () => {
    const result = expandProviderNames(['GEMINI']);
    expect(result.has('gemini')).toBe(true);
    expect(result.has('google')).toBe(true);
    expect(result.has('GEMINI')).toBe(false);
  });

  it('should pass through unknown names without expansion', () => {
    const result = expandProviderNames(['unknown-provider']);
    expect(result.has('unknown-provider')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should handle multiple names in a single call', () => {
    const result = expandProviderNames(['anthropic', 'gemini', 'custom:foo']);
    expect(result.has('anthropic')).toBe(true);
    expect(result.has('gemini')).toBe(true);
    expect(result.has('google')).toBe(true);
    expect(result.has('custom:foo')).toBe(true);
  });

  it('should handle an empty iterable', () => {
    const result = expandProviderNames([]);
    expect(result.size).toBe(0);
  });

  it('should accept any iterable, not just arrays', () => {
    const inputSet = new Set(['qwen']);
    const result = expandProviderNames(inputSet);
    expect(result.has('qwen')).toBe(true);
    expect(result.has('alibaba')).toBe(true);
  });

  it('should lowercase custom: prefix to match the startsWith check', () => {
    const result = expandProviderNames(['Custom:SomeThing']);
    expect(result.has('custom:something')).toBe(true);
    expect(result.size).toBe(1);
  });
});
