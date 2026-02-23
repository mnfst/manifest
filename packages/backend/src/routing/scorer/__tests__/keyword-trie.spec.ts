import { KeywordTrie } from '../keyword-trie';

describe('KeywordTrie', () => {
  it('builds from empty config with size 0', () => {
    const trie = new KeywordTrie([]);
    expect(trie.size).toBe(0);
  });

  it('builds from single dimension with 3 keywords', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['alpha', 'beta', 'gamma'] },
    ]);
    expect(trie.size).toBe(3);
  });

  it('returns empty array when text has no matches', () => {
    const trie = new KeywordTrie([
      { name: 'logic', keywords: ['prove', 'theorem'] },
    ]);
    expect(trie.scan('hello world')).toEqual([]);
  });

  it('returns correct match for single keyword', () => {
    const trie = new KeywordTrie([
      { name: 'logic', keywords: ['prove'] },
    ]);
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
    const trie = new KeywordTrie([
      { name: 'logic', keywords: ['prove'] },
    ]);
    const matches = trie.scan('prove that you can prove it');
    expect(matches).toHaveLength(2);
    expect(matches[0].position).not.toBe(matches[1].position);
  });

  it('respects word boundaries: "analyze" matches alone', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['analyze'] },
    ]);
    expect(trie.scan('please analyze this')).toHaveLength(1);
  });

  it('respects word boundaries: "analyze" does NOT match inside "psychoanalyze"', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['analyze'] },
    ]);
    expect(trie.scan('psychoanalyze something')).toHaveLength(0);
  });

  it('respects word boundaries: short words do NOT match inside longer words', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['or'] },
    ]);
    expect(trie.scan('order information')).toHaveLength(0);
  });

  it('matches keyword at start of string', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['prove'] },
    ]);
    const matches = trie.scan('prove it');
    expect(matches).toHaveLength(1);
    expect(matches[0].position).toBe(0);
  });

  it('matches keyword at end of string', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['prove'] },
    ]);
    const matches = trie.scan('can you prove');
    expect(matches).toHaveLength(1);
  });

  it('handles multi-word keywords as full phrases', () => {
    const trie = new KeywordTrie([
      { name: 'logic', keywords: ['if and only if'] },
    ]);
    expect(trie.scan('this holds if and only if x > 0')).toHaveLength(1);
  });

  it('does NOT partially match multi-word keywords', () => {
    const trie = new KeywordTrie([
      { name: 'logic', keywords: ['if and only if'] },
    ]);
    expect(trie.scan('if and then')).toHaveLength(0);
  });

  it('matches case-insensitively', () => {
    const trie = new KeywordTrie([
      { name: 'logic', keywords: ['prove'] },
    ]);
    expect(trie.scan('PROVE this')).toHaveLength(1);
  });

  it('handles unicode text without crashing', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['prove'] },
    ]);
    expect(() => trie.scan('证明这个 prove')).not.toThrow();
    expect(trie.scan('证明这个 prove')).toHaveLength(1);
  });

  it('returns empty results for empty text', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['prove'] },
    ]);
    expect(trie.scan('')).toEqual([]);
  });

  it('does NOT match keyword adjacent to underscore', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['api'] },
    ]);
    expect(trie.scan('api_key')).toHaveLength(0);
    expect(trie.scan('my_api')).toHaveLength(0);
  });

  it('does NOT match keyword adjacent to digit', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['step'] },
    ]);
    expect(trie.scan('step1')).toHaveLength(0);
    expect(trie.scan('2step')).toHaveLength(0);
  });

  it('matches keyword delimited by hyphen (non-word char)', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['trade'] },
    ]);
    const matches = trie.scan('trade-offs');
    expect(matches).toHaveLength(1);
    expect(matches[0].keyword).toBe('trade');
  });

  it('matches hyphenated multi-word keyword like "trade-offs"', () => {
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['trade-offs'] },
    ]);
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
    const trie = new KeywordTrie([
      { name: 'test', keywords: ['prove'] },
    ]);
    expect(trie.scan('can you (prove) this?')).toHaveLength(1);
  });

  it('scans 1000 texts of 500 chars in under 200ms', () => {
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
    expect(elapsed).toBeLessThan(200);
  });
});
