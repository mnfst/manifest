import {
  FALLBACK_KEY_DELIMITER,
  encodeFallbackEntry,
  parseFallbackEntry,
} from '../src/fallback-encoding';

describe('fallback-encoding', () => {
  describe('parseFallbackEntry', () => {
    it('returns the bare model when there is no delimiter', () => {
      expect(parseFallbackEntry('gemini-2.5-flash')).toEqual({ model: 'gemini-2.5-flash' });
    });

    it('returns an empty model for an empty input', () => {
      expect(parseFallbackEntry('')).toEqual({ model: '' });
    });

    it('parses model + label when the delimiter is present', () => {
      expect(parseFallbackEntry('gemini-2.5-flash||Work')).toEqual({
        model: 'gemini-2.5-flash',
        providerKeyLabel: 'Work',
      });
    });

    it('preserves OpenRouter-style slash-prefixed model ids', () => {
      expect(parseFallbackEntry('anthropic/claude-opus-4-6||Personal')).toEqual({
        model: 'anthropic/claude-opus-4-6',
        providerKeyLabel: 'Personal',
      });
    });

    it('preserves Ollama tag-style ids that contain a single colon', () => {
      // A single `:` is fine — only `||` separates fields.
      expect(parseFallbackEntry('cogito-2.1:671b||Key 2')).toEqual({
        model: 'cogito-2.1:671b',
        providerKeyLabel: 'Key 2',
      });
    });

    it('drops empty labels (trailing delimiter) so they do not create a phantom pin', () => {
      expect(parseFallbackEntry('gpt-4o||')).toEqual({ model: 'gpt-4o' });
      expect(parseFallbackEntry('gpt-4o||   ')).toEqual({ model: 'gpt-4o' });
    });

    it('only splits on the first delimiter occurrence', () => {
      // Labels themselves cannot contain `||` (validated upstream), but if
      // they do somehow, the suffix after the first split goes into the
      // label verbatim.
      expect(parseFallbackEntry('gpt-4o||Work||extra')).toEqual({
        model: 'gpt-4o',
        providerKeyLabel: 'Work||extra',
      });
    });
  });

  describe('encodeFallbackEntry', () => {
    it('returns the bare model when no label is set', () => {
      expect(encodeFallbackEntry({ model: 'gemini-2.5-flash' })).toBe('gemini-2.5-flash');
    });

    it('appends the label using the delimiter when present', () => {
      expect(
        encodeFallbackEntry({ model: 'gemini-2.5-flash', providerKeyLabel: 'Work' }),
      ).toBe('gemini-2.5-flash||Work');
    });

    it('parse(encode(x)) is an identity for entries with a label', () => {
      const original = { model: 'cogito-2.1:671b', providerKeyLabel: 'Key 2' };
      expect(parseFallbackEntry(encodeFallbackEntry(original))).toEqual(original);
    });

    it('parse(encode(x)) is an identity for entries without a label', () => {
      const original = { model: 'gpt-4o' };
      expect(parseFallbackEntry(encodeFallbackEntry(original))).toEqual(original);
    });
  });

  it('exposes the delimiter as a public constant', () => {
    expect(FALLBACK_KEY_DELIMITER).toBe('||');
  });
});
