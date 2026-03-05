import {
  stripProviderPrefix,
  stripDateSuffix,
  buildAliasMap,
  resolveModelName,
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

    it('includes MiniMax mixed-case aliases', () => {
      const map = buildAliasMap(['minimax-m2.5', 'minimax-m1']);
      expect(map.get('MiniMax-M2.5')).toBe('minimax-m2.5');
      expect(map.get('MiniMax-M1')).toBe('minimax-m1');
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
      const map = buildAliasMap(['minimax-m2.5', 'minimax-m1']);
      expect(resolveModelName('MiniMax-M2.5', map)).toBe('minimax-m2.5');
    });

    it('resolves minimax/ prefixed model', () => {
      const map = buildAliasMap(['minimax-m2.5']);
      expect(resolveModelName('minimax/minimax-m2.5', map)).toBe('minimax-m2.5');
    });
  });
});
