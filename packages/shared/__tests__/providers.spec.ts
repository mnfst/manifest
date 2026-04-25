import {
  SHARED_PROVIDERS,
  SHARED_PROVIDER_BY_ID,
  SHARED_PROVIDER_BY_ID_OR_ALIAS,
  LOCAL_SERVER_HINTS,
  normalizeProviderName,
} from '../src/providers';

describe('normalizeProviderName', () => {
  it('lowercases the input', () => {
    expect(normalizeProviderName('LM Studio')).toBe('lmstudio');
    expect(normalizeProviderName('ANTHROPIC')).toBe('anthropic');
  });

  it('collapses whitespace, dots, hyphens, and underscores', () => {
    // All variants of the same name must hash to the same key so the
    // registry lookup works regardless of how the user typed the name.
    expect(normalizeProviderName('lm studio')).toBe('lmstudio');
    expect(normalizeProviderName('lm-studio')).toBe('lmstudio');
    expect(normalizeProviderName('lm.studio')).toBe('lmstudio');
    expect(normalizeProviderName('lm_studio')).toBe('lmstudio');
    expect(normalizeProviderName('llama.cpp')).toBe('llamacpp');
    expect(normalizeProviderName('llama-cpp')).toBe('llamacpp');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeProviderName('  openai  ')).toBe('openai');
  });

  it('collapses runs of separators to a single removal (not a single dash)', () => {
    // "a -_ b" must produce "ab", not "a-b" or "a_b".
    expect(normalizeProviderName('a -_ b')).toBe('ab');
  });
});

describe('SHARED_PROVIDER_BY_ID_OR_ALIAS', () => {
  it('resolves canonical ids to their shared entry', () => {
    expect(SHARED_PROVIDER_BY_ID_OR_ALIAS.get('anthropic')?.id).toBe('anthropic');
    expect(SHARED_PROVIDER_BY_ID_OR_ALIAS.get('openai')?.id).toBe('openai');
    expect(SHARED_PROVIDER_BY_ID_OR_ALIAS.get('llamacpp')?.id).toBe('llamacpp');
  });

  it('resolves every declared alias to the same entry as its canonical id', () => {
    for (const p of SHARED_PROVIDERS) {
      for (const alias of p.aliases) {
        const entryByAlias = SHARED_PROVIDER_BY_ID_OR_ALIAS.get(alias);
        expect(entryByAlias?.id).toBe(p.id);
      }
    }
  });

  it('resolves llama.cpp and lm-studio aliases to their canonical tile-only entries', () => {
    // These are the aliases consumed by CustomProviderService.canonicalTileIdForName
    // to rewrite `custom:<uuid>` provider rows into first-class dashboard entries.
    expect(SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalizeProviderName('llama.cpp'))?.id).toBe(
      'llamacpp',
    );
    expect(SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalizeProviderName('LM Studio'))?.id).toBe(
      'lmstudio',
    );
  });

  it('returns undefined for unknown names', () => {
    expect(SHARED_PROVIDER_BY_ID_OR_ALIAS.get('unknownprovider')).toBeUndefined();
  });
});

describe('SHARED_PROVIDER_BY_ID', () => {
  it('is keyed by canonical id only (aliases do not resolve)', () => {
    // Alibaba has alias 'alibaba' → both must resolve via BY_ID_OR_ALIAS
    // but only the canonical 'qwen' must resolve via BY_ID.
    expect(SHARED_PROVIDER_BY_ID.get('qwen')?.id).toBe('qwen');
    expect(SHARED_PROVIDER_BY_ID.get('alibaba')).toBeUndefined();
    expect(SHARED_PROVIDER_BY_ID_OR_ALIAS.get('alibaba')?.id).toBe('qwen');
  });
});

describe('LOCAL_SERVER_HINTS', () => {
  it('provides a setup hint for every tileOnly / localOnly registry entry that users connect via the tile UI', () => {
    // Every provider with a local-server setup flow (llama.cpp, LM Studio,
    // Ollama) must ship a hint so the failure state has something to show.
    // Ollama-cloud is NOT local so it's excluded.
    const tileLocalIds = SHARED_PROVIDERS.filter(
      (p) => p.tileOnly || (p.localOnly && p.id !== 'ollama-cloud'),
    ).map((p) => p.id);
    for (const id of tileLocalIds) {
      expect(LOCAL_SERVER_HINTS[id]).toBeDefined();
      expect(LOCAL_SERVER_HINTS[id].setupCommand).toBeTruthy();
      expect(LOCAL_SERVER_HINTS[id].installUrl).toBeTruthy();
    }
  });

  it('supplies a notReachableHint for llama.cpp (pre-b3800 builds have no /v1/models)', () => {
    // The failure state surfaces this as a clickable escape hatch to the
    // custom-provider form when the probe 404s on old llama-server builds.
    const hint = LOCAL_SERVER_HINTS.llamacpp;
    expect(hint.notReachableHint).toBeDefined();
    expect(hint.notReachableHint!.linkLabel).toBe('Add custom provider');
    expect(hint.notReachableHint!.before).toMatch(/\/v1\/models/);
    expect(hint.notReachableHint!.after).toMatch(/register the model/);
  });

  it('sets persistsBindAcrossLaunches only for LM Studio (GUI-wrapped providers)', () => {
    // The frontend gates the "Developer → Start Server" fallback copy on
    // this flag; CLI-only servers (llama.cpp) must NOT trigger it.
    expect(LOCAL_SERVER_HINTS.lmstudio.persistsBindAcrossLaunches).toBe(true);
    expect(LOCAL_SERVER_HINTS.llamacpp.persistsBindAcrossLaunches).toBeUndefined();
    expect(LOCAL_SERVER_HINTS.ollama.persistsBindAcrossLaunches).toBeUndefined();
  });
});
