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
      const map = buildAliasMap(['deepseek-v3', 'deepseek-r1']);
      expect(map.get('deepseek-chat')).toBe('deepseek-v3');
      expect(map.get('deepseek-reasoner')).toBe('deepseek-r1');
    });
  });

  describe('resolveModelName', () => {
    const canonical = [
      'claude-opus-4-6',
      'claude-sonnet-4-5-20250929',
      'gpt-4o',
      'gpt-4.1',
      'deepseek-v3',
      'deepseek-r1',
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

    it('resolves deepseek-chat to deepseek-v3', () => {
      expect(resolveModelName('deepseek-chat', aliasMap)).toBe('deepseek-v3');
    });

    it('resolves deepseek-reasoner to deepseek-r1', () => {
      expect(resolveModelName('deepseek-reasoner', aliasMap)).toBe('deepseek-r1');
    });

    it('resolves prefixed deepseek alias', () => {
      expect(resolveModelName('deepseek/deepseek-chat', aliasMap)).toBe('deepseek-v3');
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
  });
});
