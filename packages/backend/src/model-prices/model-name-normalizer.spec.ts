import {
  stripProviderPrefix,
  stripDateSuffix,
  buildAliasMap,
  resolveModelName,
  normalizeDots,
  stripGoogleVariant,
} from './model-name-normalizer';

describe('model-name-normalizer', () => {
  describe('stripProviderPrefix', () => {
    it('strips anthropic/ prefix', () => {
      expect(stripProviderPrefix('anthropic/claude-opus-4-6')).toBe('claude-opus-4-6');
    });

    it('strips openai/ prefix', () => {
      expect(stripProviderPrefix('openai/gpt-4o')).toBe('gpt-4o');
    });

    it('strips zhipuai/ prefix', () => {
      expect(stripProviderPrefix('zhipuai/glm-4-plus')).toBe('glm-4-plus');
    });

    it('strips amazon/ prefix', () => {
      expect(stripProviderPrefix('amazon/nova-pro')).toBe('nova-pro');
    });

    it('strips accounts/fireworks/models/ prefix', () => {
      expect(stripProviderPrefix('accounts/fireworks/models/llama-v3')).toBe('llama-v3');
    });

    it('strips minimax/ prefix', () => {
      expect(stripProviderPrefix('minimax/minimax-m2.5')).toBe('minimax-m2.5');
    });

    it('strips z-ai/ prefix', () => {
      expect(stripProviderPrefix('z-ai/glm-5')).toBe('glm-5');
    });

    it('returns name unchanged when no prefix matches', () => {
      expect(stripProviderPrefix('gpt-4o')).toBe('gpt-4o');
    });

    it('only strips the first matching prefix', () => {
      expect(stripProviderPrefix('openai/openai/gpt-4o')).toBe('openai/gpt-4o');
    });
  });

  describe('stripDateSuffix', () => {
    it('strips trailing YYYY-MM-DD date', () => {
      expect(stripDateSuffix('gpt-4.1-2025-04-14')).toBe('gpt-4.1');
    });

    it('strips date from claude model names', () => {
      expect(stripDateSuffix('claude-sonnet-4-20250514-2025-05-14')).toBe(
        'claude-sonnet-4-20250514',
      );
    });

    it('returns name unchanged when no date suffix', () => {
      expect(stripDateSuffix('gpt-4o')).toBe('gpt-4o');
    });

    it('does not strip non-date numeric suffixes', () => {
      expect(stripDateSuffix('qwen3-235b-a22b')).toBe('qwen3-235b-a22b');
    });
  });

  describe('normalizeDots', () => {
    it('replaces dots with dashes', () => {
      expect(normalizeDots('claude-opus-4.6')).toBe('claude-opus-4-6');
    });

    it('replaces multiple dots', () => {
      expect(normalizeDots('model-1.2.3')).toBe('model-1-2-3');
    });

    it('returns name unchanged when no dots', () => {
      expect(normalizeDots('claude-opus-4-6')).toBe('claude-opus-4-6');
    });
  });

  describe('stripGoogleVariant', () => {
    it('strips -preview-MM-DD suffix', () => {
      expect(stripGoogleVariant('gemini-2.5-pro-preview-03-25')).toBe('gemini-2.5-pro');
    });

    it('strips -preview-YYYY-MM-DD suffix', () => {
      expect(stripGoogleVariant('gemini-2.5-pro-preview-2025-03-25')).toBe('gemini-2.5-pro');
    });

    it('strips -exp-MMDD suffix', () => {
      expect(stripGoogleVariant('gemini-2.5-pro-exp-0325')).toBe('gemini-2.5-pro');
    });

    it('strips -latest suffix', () => {
      expect(stripGoogleVariant('gemini-2.5-pro-latest')).toBe('gemini-2.5-pro');
    });

    it('returns name unchanged for non-Google models', () => {
      expect(stripGoogleVariant('gpt-4o')).toBe('gpt-4o');
    });

    it('returns name unchanged for models without variant suffix', () => {
      expect(stripGoogleVariant('gemini-2.5-pro')).toBe('gemini-2.5-pro');
    });
  });

  describe('buildAliasMap', () => {
    it('maps canonical names to themselves', () => {
      const map = buildAliasMap(['gpt-4o', 'claude-opus-4-6']);
      expect(map.get('gpt-4o')).toBe('gpt-4o');
      expect(map.get('claude-opus-4-6')).toBe('claude-opus-4-6');
    });

    it('includes known aliases', () => {
      const map = buildAliasMap(['claude-opus-4-6']);
      expect(map.get('claude-opus-4')).toBe('claude-opus-4-6');
    });

    it('includes deepseek aliases', () => {
      const map = buildAliasMap(['deepseek-chat', 'deepseek-reasoner']);
      expect(map.get('deepseek-v3')).toBe('deepseek-chat');
      expect(map.get('deepseek-r1')).toBe('deepseek-reasoner');
    });

    it('indexes bare name for vendor-prefixed canonical names', () => {
      const map = buildAliasMap(['anthropic/claude-opus-4-6']);
      expect(map.get('claude-opus-4-6')).toBe('anthropic/claude-opus-4-6');
    });

    it('indexes Anthropic dash variant when canonical name uses dots', () => {
      const map = buildAliasMap(['anthropic/claude-sonnet-4.6']);
      expect(map.get('claude-sonnet-4-6')).toBe('anthropic/claude-sonnet-4.6');
      expect(map.get('anthropic/claude-sonnet-4-6')).toBe('anthropic/claude-sonnet-4.6');
    });

    it('includes MiniMax mixed-case aliases', () => {
      const map = buildAliasMap(['minimax-m2.7', 'minimax-m2.5', 'minimax-m1']);
      expect(map.get('MiniMax-M2.7')).toBe('minimax-m2.7');
      expect(map.get('MiniMax-M2.7-highspeed')).toBe('minimax-m2.7-highspeed');
      expect(map.get('MiniMax-M2.5')).toBe('minimax-m2.5');
      expect(map.get('MiniMax-M1')).toBe('minimax-m1');
    });

    it('indexes by bare name without version suffix', () => {
      const map = buildAliasMap(['google/gemini-2.0-flash-001']);
      expect(map.get('gemini-2.0-flash')).toBe('google/gemini-2.0-flash-001');
    });

    it('does not strip version suffix when it would empty the name', () => {
      const map = buildAliasMap(['google/gemini-001']);
      // gemini-001 bare → gemini (suffix stripped), but gemini-001 should also exist
      expect(map.get('gemini-001')).toBe('google/gemini-001');
    });

    it('indexes short name for canonical names with Google variant suffix', () => {
      const map = buildAliasMap(['gemini-2.5-pro-preview-03-25']);
      expect(map.get('gemini-2.5-pro')).toBe('gemini-2.5-pro-preview-03-25');
    });

    it('indexes short name for vendor-prefixed Google variant', () => {
      const map = buildAliasMap(['google/gemini-2.5-pro-exp-0325']);
      expect(map.get('gemini-2.5-pro')).toBe('google/gemini-2.5-pro-exp-0325');
    });

    it('does not overwrite existing entry when stripping Google variant', () => {
      const map = buildAliasMap(['gemini-2.5-pro', 'gemini-2.5-pro-preview-03-25']);
      expect(map.get('gemini-2.5-pro')).toBe('gemini-2.5-pro');
    });
  });

  describe('resolveModelName', () => {
    const canonical = [
      'claude-opus-4-6',
      'claude-sonnet-4-5-20250929',
      'gpt-4o',
      'gpt-4.1',
      'deepseek-chat',
      'deepseek-reasoner',
      'glm-4-plus',
      'nova-pro',
    ];
    const aliasMap = buildAliasMap(canonical);

    it('returns exact match for canonical name', () => {
      expect(resolveModelName('gpt-4o', aliasMap)).toBe('gpt-4o');
    });

    it('resolves known alias', () => {
      expect(resolveModelName('claude-opus-4', aliasMap)).toBe('claude-opus-4-6');
    });

    it('resolves provider-prefixed name', () => {
      expect(resolveModelName('openai/gpt-4o', aliasMap)).toBe('gpt-4o');
    });

    it('resolves provider-prefixed alias', () => {
      expect(resolveModelName('anthropic/claude-opus-4', aliasMap)).toBe('claude-opus-4-6');
    });

    it('resolves name with date suffix', () => {
      expect(resolveModelName('gpt-4.1-2025-04-14', aliasMap)).toBe('gpt-4.1');
    });

    it('resolves name with both prefix and date suffix', () => {
      expect(resolveModelName('openai/gpt-4.1-2025-04-14', aliasMap)).toBe('gpt-4.1');
    });

    it('resolves deepseek-v3 to deepseek-chat', () => {
      expect(resolveModelName('deepseek-v3', aliasMap)).toBe('deepseek-chat');
    });

    it('resolves deepseek-r1 to deepseek-reasoner', () => {
      expect(resolveModelName('deepseek-r1', aliasMap)).toBe('deepseek-reasoner');
    });

    it('resolves prefixed deepseek alias', () => {
      expect(resolveModelName('deepseek/deepseek-v3', aliasMap)).toBe('deepseek-chat');
    });

    it('resolves zhipuai/ prefixed model', () => {
      expect(resolveModelName('zhipuai/glm-4-plus', aliasMap)).toBe('glm-4-plus');
    });

    it('resolves amazon/ prefixed model', () => {
      expect(resolveModelName('amazon/nova-pro', aliasMap)).toBe('nova-pro');
    });

    it('returns undefined for unknown model', () => {
      expect(resolveModelName('totally-unknown-model', aliasMap)).toBeUndefined();
    });

    it('returns undefined for unknown prefixed model', () => {
      expect(resolveModelName('openai/nonexistent', aliasMap)).toBeUndefined();
    });

    it('resolves MiniMax mixed-case alias', () => {
      const map = buildAliasMap(['minimax-m2.7', 'minimax-m2.5', 'minimax-m1']);
      expect(resolveModelName('MiniMax-M2.7', map)).toBe('minimax-m2.7');
      expect(resolveModelName('MiniMax-M2.7-highspeed', map)).toBe('minimax-m2.7-highspeed');
      expect(resolveModelName('MiniMax-M2.5', map)).toBe('minimax-m2.5');
    });

    it('resolves minimax/ prefixed model', () => {
      const map = buildAliasMap(['minimax-m2.5']);
      expect(resolveModelName('minimax/minimax-m2.5', map)).toBe('minimax-m2.5');
    });

    it('resolves dot-variant to dash-canonical via normalization', () => {
      expect(resolveModelName('claude-opus-4.6', aliasMap)).toBe('claude-opus-4-6');
    });

    it('resolves prefixed dot-variant', () => {
      expect(resolveModelName('anthropic/claude-opus-4.6', aliasMap)).toBe('claude-opus-4-6');
    });

    it('resolves dot-variant with date suffix', () => {
      const map = buildAliasMap(['claude-sonnet-4-6']);
      expect(resolveModelName('claude-sonnet-4.6-2025-06-01', map)).toBe('claude-sonnet-4-6');
    });

    it('prioritizes exact match over dot normalization', () => {
      expect(resolveModelName('gpt-4.1', aliasMap)).toBe('gpt-4.1');
    });

    it('returns undefined for unknown dot-variant', () => {
      expect(resolveModelName('unknown-1.0', aliasMap)).toBeUndefined();
    });

    it('resolves dot-variant through alias after normalization', () => {
      const map = buildAliasMap(['claude-sonnet-4-5-20250929']);
      expect(resolveModelName('claude-sonnet-4.5', map)).toBe('claude-sonnet-4-5-20250929');
    });

    it('resolves Anthropic dash variant when canonical name uses dots', () => {
      const map = buildAliasMap(['anthropic/claude-opus-4.6']);
      expect(resolveModelName('claude-opus-4-6', map)).toBe('anthropic/claude-opus-4.6');
    });

    it('resolves Google preview variant to canonical', () => {
      expect(resolveModelName('gemini-2.5-pro-preview-03-25', aliasMap)).toBeUndefined();
      const map = buildAliasMap(['gemini-2.5-pro']);
      expect(resolveModelName('gemini-2.5-pro-preview-03-25', map)).toBe('gemini-2.5-pro');
    });

    it('resolves Google exp variant to canonical', () => {
      const map = buildAliasMap(['gemini-2.5-pro']);
      expect(resolveModelName('gemini-2.5-pro-exp-0325', map)).toBe('gemini-2.5-pro');
    });

    it('resolves Google latest variant to canonical', () => {
      const map = buildAliasMap(['gemini-2.5-pro']);
      expect(resolveModelName('gemini-2.5-pro-latest', map)).toBe('gemini-2.5-pro');
    });

    it('resolves prefixed Google preview variant', () => {
      const map = buildAliasMap(['gemini-2.5-pro']);
      expect(resolveModelName('google/gemini-2.5-pro-preview-03-25', map)).toBe('gemini-2.5-pro');
    });

    it('resolves short name when pricing has Google variant canonical', () => {
      const map = buildAliasMap(['gemini-2.5-pro-preview-03-25']);
      expect(resolveModelName('gemini-2.5-pro', map)).toBe('gemini-2.5-pro-preview-03-25');
    });
  });
});
