import { KeywordTrie, isWordCharCode } from '../keyword-trie';

describe('KeywordTrie', () => {
  it('builds from empty config with size 0', () => {
    const trie = new KeywordTrie([]);
    expect(trie.size).toBe(0);
  });

  it('builds from single dimension with 3 keywords', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['alpha', 'beta', 'gamma'] }]);
    expect(trie.size).toBe(3);
  });

  it('returns empty array when text has no matches', () => {
    const trie = new KeywordTrie([{ name: 'logic', keywords: ['prove', 'theorem'] }]);
    expect(trie.scan('hello world')).toEqual([]);
  });

  it('returns correct match for single keyword', () => {
    const trie = new KeywordTrie([{ name: 'logic', keywords: ['prove'] }]);
    const matches = trie.scan('please prove this');
    expect(matches).toHaveLength(1);
    expect(matches[0].keyword).toBe('prove');
    expect(matches[0].dimension).toBe('logic');
    expect(matches[0].position).toBe(7);
  });

  it('returns matches from multiple dimensions', () => {
    const trie = new KeywordTrie([
      { name: 'logic', keywords: ['prove'] },
      { name: 'code', keywords: ['implement'] },
    ]);
    const matches = trie.scan('prove and implement this');
    expect(matches).toHaveLength(2);
    const dims = matches.map((m) => m.dimension).sort();
    expect(dims).toEqual(['code', 'logic']);
  });

  it('returns both occurrences of a repeated keyword', () => {
    const trie = new KeywordTrie([{ name: 'logic', keywords: ['prove'] }]);
    const matches = trie.scan('prove that you can prove it');
    expect(matches).toHaveLength(2);
    expect(matches[0].position).not.toBe(matches[1].position);
  });

  it('respects word boundaries: "analyze" matches alone', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['analyze'] }]);
    expect(trie.scan('please analyze this')).toHaveLength(1);
  });

  it('respects word boundaries: "analyze" does NOT match inside "psychoanalyze"', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['analyze'] }]);
    expect(trie.scan('psychoanalyze something')).toHaveLength(0);
  });

  it('respects word boundaries: short words do NOT match inside longer words', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['or'] }]);
    expect(trie.scan('order information')).toHaveLength(0);
  });

  it('matches keyword at start of string', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['prove'] }]);
    const matches = trie.scan('prove it');
    expect(matches).toHaveLength(1);
    expect(matches[0].position).toBe(0);
  });

  it('matches keyword at end of string', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['prove'] }]);
    const matches = trie.scan('can you prove');
    expect(matches).toHaveLength(1);
  });

  it('handles multi-word keywords as full phrases', () => {
    const trie = new KeywordTrie([{ name: 'logic', keywords: ['if and only if'] }]);
    expect(trie.scan('this holds if and only if x > 0')).toHaveLength(1);
  });

  it('does NOT partially match multi-word keywords', () => {
    const trie = new KeywordTrie([{ name: 'logic', keywords: ['if and only if'] }]);
    expect(trie.scan('if and then')).toHaveLength(0);
  });

  it('matches case-insensitively', () => {
    const trie = new KeywordTrie([{ name: 'logic', keywords: ['prove'] }]);
    expect(trie.scan('PROVE this')).toHaveLength(1);
  });

  it('handles unicode text without crashing', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['prove'] }]);
    expect(() => trie.scan('证明这个 prove')).not.toThrow();
    expect(trie.scan('证明这个 prove')).toHaveLength(1);
  });

  it('returns empty results for empty text', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['prove'] }]);
    expect(trie.scan('')).toEqual([]);
  });

  it('does NOT match keyword adjacent to underscore', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['api'] }]);
    expect(trie.scan('api_key')).toHaveLength(0);
    expect(trie.scan('my_api')).toHaveLength(0);
  });

  it('does NOT match keyword adjacent to digit', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['step'] }]);
    expect(trie.scan('step1')).toHaveLength(0);
    expect(trie.scan('2step')).toHaveLength(0);
  });

  it('matches keyword delimited by hyphen (non-word char)', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['trade'] }]);
    const matches = trie.scan('trade-offs');
    expect(matches).toHaveLength(1);
    expect(matches[0].keyword).toBe('trade');
  });

  it('matches hyphenated multi-word keyword like "trade-offs"', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['trade-offs'] }]);
    expect(trie.scan('discuss trade-offs')).toHaveLength(1);
  });

  it('counts keywords from multiple dimensions in size', () => {
    const trie = new KeywordTrie([
      { name: 'a', keywords: ['one', 'two'] },
      { name: 'b', keywords: ['three'] },
    ]);
    expect(trie.size).toBe(3);
  });

  it('matches keyword preceded by punctuation', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['prove'] }]);
    expect(trie.scan('can you (prove) this?')).toHaveLength(1);
  });

  it('scans 1000 texts of 500 chars in under 500ms', () => {
    const trie = new KeywordTrie([
      { name: 'a', keywords: ['algorithm', 'database', 'architecture'] },
      { name: 'b', keywords: ['prove', 'theorem', 'induction'] },
      { name: 'c', keywords: ['implement', 'create', 'build'] },
    ]);

    const text =
      'Please implement a distributed algorithm that proves the theorem about database architecture. '.repeat(
        6,
      );

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      trie.scan(text);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('does NOT match keyword beyond MAX_SCAN_LENGTH (100k char boundary)', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['target'] }]);
    // 'target' starts at position 100,500 — entirely past the 100,000 truncation point.
    const text = ''.padEnd(100500, 'x') + 'target' + 'y'.repeat(400);
    expect(text.length).toBe(100906);
    const matches = trie.scan(text);
    expect(matches).toEqual([]);
  });

  it('matches keyword that fits entirely within MAX_SCAN_LENGTH boundary', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['target'] }]);
    // 'target' (6 chars) starts at position 99,994 — last char lands at index 99,999.
    // Preceded by a space (non-word char) so the word-boundary check passes.
    // afterIdx = 100,000 === len, so the trailing word-char check is skipped → match.
    const text = 'x'.repeat(99993) + ' ' + 'target' + 'y'.repeat(100);
    expect(text.length).toBe(100100);
    const matches = trie.scan(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].keyword).toBe('target');
    expect(matches[0].position).toBe(99994);
  });

  it('does NOT match keyword spanning MAX_SCAN_LENGTH boundary', () => {
    const trie = new KeywordTrie([{ name: 'test', keywords: ['target'] }]);
    // 'target' straddles position 99,997..100,002 — last 3 chars are past the cap so
    // the inner loop exits before reaching a terminal node.
    const text = 'x'.repeat(99996) + ' ' + 'target' + 'y'.repeat(100);
    expect(text.length).toBe(100103);
    const matches = trie.scan(text);
    expect(matches).toEqual([]);
  });

  describe('isWordCharCode', () => {
    it('returns true for digits 0-9 (codes 48-57)', () => {
      for (let code = 48; code <= 57; code++) {
        expect(isWordCharCode(code)).toBe(true);
      }
    });

    it('returns true for uppercase A-Z (codes 65-90)', () => {
      for (let code = 65; code <= 90; code++) {
        expect(isWordCharCode(code)).toBe(true);
      }
    });

    it('returns true for lowercase a-z (codes 97-122)', () => {
      for (let code = 97; code <= 122; code++) {
        expect(isWordCharCode(code)).toBe(true);
      }
    });

    it('returns true for underscore (code 95)', () => {
      expect(isWordCharCode(95)).toBe(true);
      expect(isWordCharCode('_'.charCodeAt(0))).toBe(true);
    });

    it('returns false for space (32) and hyphen (45)', () => {
      expect(isWordCharCode(32)).toBe(false);
      expect(isWordCharCode(45)).toBe(false);
      expect(isWordCharCode(' '.charCodeAt(0))).toBe(false);
      expect(isWordCharCode('-'.charCodeAt(0))).toBe(false);
    });

    it('returns false at boundaries just outside digit range (47 and 58)', () => {
      // 47 = '/', 58 = ':' — one below '0' and one above '9'.
      expect(isWordCharCode(47)).toBe(false);
      expect(isWordCharCode(58)).toBe(false);
    });

    it('returns false at boundaries just outside uppercase range (64 and 91)', () => {
      // 64 = '@', 91 = '[' — one below 'A' and one above 'Z'.
      expect(isWordCharCode(64)).toBe(false);
      expect(isWordCharCode(91)).toBe(false);
    });

    it('returns false at boundaries just outside lowercase range (96 and 123)', () => {
      // 96 = '`', 123 = '{' — one below 'a' and one above 'z'.
      expect(isWordCharCode(96)).toBe(false);
      expect(isWordCharCode(123)).toBe(false);
    });

    it('returns false for code 94 (just below underscore)', () => {
      // 94 = '^' — verifies the underscore check is exact, not a range.
      expect(isWordCharCode(94)).toBe(false);
    });

    it('returns false for common punctuation and whitespace', () => {
      expect(isWordCharCode('.'.charCodeAt(0))).toBe(false);
      expect(isWordCharCode(','.charCodeAt(0))).toBe(false);
      expect(isWordCharCode('!'.charCodeAt(0))).toBe(false);
      expect(isWordCharCode('?'.charCodeAt(0))).toBe(false);
      expect(isWordCharCode('\t'.charCodeAt(0))).toBe(false);
      expect(isWordCharCode('\n'.charCodeAt(0))).toBe(false);
    });
  });
});
