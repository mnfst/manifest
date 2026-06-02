import { peelEnvelope } from '../envelope-peeler';

const OPENCLAW = [
  'Sender (untrusted metadata):',
  '```json',
  '{ "label": "openclaw-tui", "id": "openclaw-tui" }',
  '```',
  '',
  'say hello',
].join('\n');

describe('peelEnvelope', () => {
  it('returns empty input unchanged', () => {
    expect(peelEnvelope('')).toBe('');
  });

  it('strips a labeled JSON envelope and returns the human prompt (#1766)', () => {
    expect(peelEnvelope(OPENCLAW)).toBe('say hello');
  });

  it('strips an unlabeled leading json fence with structured body', () => {
    const wrapped = '```json\n{"k":"v"}\n```\n\nhi';
    expect(peelEnvelope(wrapped)).toBe('hi');
  });

  it('strips a yaml envelope', () => {
    const wrapped = '```yaml\nlabel: openclaw\nid: tui\n```\n\nhello world';
    expect(peelEnvelope(wrapped)).toBe('hello world');
  });

  it('strips a fence whose body parses as JSON even without a language hint', () => {
    const wrapped = '```\n{"label":"x"}\n```\n\nhey';
    expect(peelEnvelope(wrapped)).toBe('hey');
  });

  it('strips a fence whose body looks like YAML even without a language hint', () => {
    const wrapped = '```\nlabel: openclaw-tui\nid: openclaw-tui\n```\n\nthanks';
    expect(peelEnvelope(wrapped)).toBe('thanks');
  });

  it('preserves a code fence wrapping real code (no false peel)', () => {
    const text = '```ts\nfunction add(a: number, b: number) { return a + b; }\n```';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('preserves text with no leading fence', () => {
    expect(peelEnvelope('say hello')).toBe('say hello');
  });

  it('preserves a fence that is not at the start of the message', () => {
    const text = 'here is some json:\n```json\n{}\n```';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('returns the original when an envelope header has no following fence', () => {
    const text = 'Sender (untrusted metadata):\nhello';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('returns the original when nothing follows the envelope', () => {
    const text = '```json\n{"k":"v"}\n```';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('peels an empty body when the language hint is structured', () => {
    // A labeled `json` fence is unambiguously envelope-shaped even when
    // empty — peeling is safe and produces the human prompt.
    expect(peelEnvelope('```json\n\n```\n\nhi')).toBe('hi');
  });

  it('does not peel an empty unlabeled fence (no structural signal)', () => {
    // Without a language hint and with no structured body, the fence could
    // be anything — keep the original so the scorer sees what arrived.
    const text = '```\n\n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('returns the original for a fenced array with trailing content', () => {
    const wrapped = '```json\n[1,2,3]\n```\n\nthat is the data';
    expect(peelEnvelope(wrapped)).toBe('that is the data');
  });

  it('does not peel a single-line yaml-shaped fence (insufficient structure)', () => {
    // One `key: value` line could just as easily be prose. We require ≥2
    // structured lines before peeling an unlabeled fence.
    const text = '```\nlabel: x\n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('does not peel when fence body is non-structured prose', () => {
    const text = '```\nthis is just a paragraph not data\n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('handles other envelope headers like "context:" and "system message:"', () => {
    const a = 'context:\n```json\n{"a":1}\n```\n\nask me anything';
    const b = 'system message:\n```yaml\nrole: dev\nteam: infra\n```\n\nhelp';
    expect(peelEnvelope(a)).toBe('ask me anything');
    expect(peelEnvelope(b)).toBe('help');
  });

  it('preserves multi-line trailing content after the envelope', () => {
    const wrapped = 'Sender (untrusted metadata):\n```json\n{"k":"v"}\n```\n\nline one\nline two';
    expect(peelEnvelope(wrapped)).toBe('line one\nline two');
  });

  // ---------------------------------------------------------------------------
  // looksLikeStructuredData heuristic — exercised via peelEnvelope on unlabeled
  // fences. The body must independently look structured (>=2 yaml-shaped lines
  // or balanced { } / [ ]) for an unlabeled fence to be treated as an envelope.
  // ---------------------------------------------------------------------------

  it('peels an unlabeled YAML fence with blank lines interleaved between valid keys', () => {
    // Blank lines are skipped by the heuristic; the two `key: value` lines
    // still satisfy the >=2 yamlLines threshold.
    const wrapped = '```\nlabel: openclaw\n\nid: tui\n```\n\nhello';
    expect(peelEnvelope(wrapped)).toBe('hello');
  });

  it('peels an unlabeled fence that uses YAML list-item syntax', () => {
    // The `^- ` branch of the heuristic — two list items count as structure.
    const wrapped = '```\n- one\n- two\n```\n\nlist follows';
    expect(peelEnvelope(wrapped)).toBe('list follows');
  });

  it('does not peel a fence with a bare key followed by list items (no value on the key)', () => {
    // `labels:` has no value after the colon, so the key-value regex rejects
    // it and the line is also not a `- ` list item. The heuristic short-
    // circuits to false on the first non-matching line.
    const text = '```\nlabels:\n- a\n- b\nid: tui\n```\n\nmixed shape';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('peels an unlabeled fence whose YAML keys carry value content', () => {
    const wrapped = '```\nname: agent\nversion: 1\n- item\n```\n\nhi';
    expect(peelEnvelope(wrapped)).toBe('hi');
  });

  it('does not peel a fence that mixes one YAML line with prose', () => {
    // First line is YAML-shaped; the prose line breaks the structure check
    // and the heuristic short-circuits to false.
    const text = '```\nlabel: openclaw\nbut also some prose here\n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('does not peel a fence whose key has no value after the colon', () => {
    // The regex requires `\s*:\s*\S` — bare `key:` lines must not count.
    const text = '```\nlabel:\nid:\n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('does not peel a fence whose lines look like prose with a colon (no leading identifier)', () => {
    // The identifier anchor `^[A-Za-z_]` rejects lines starting with punctuation,
    // digits, or whitespace — useful for sentences that happen to contain ":".
    const text = '```\n1: skip\n2: skip\n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('peels keys containing dots, dashes, and underscores', () => {
    // `\w.-` in the identifier tail must accept these characters.
    const wrapped = '```\nmodel.id: gpt-4\nagent-name: cli_v2\n```\n\ngo';
    expect(peelEnvelope(wrapped)).toBe('go');
  });

  it('peels a balanced JSON object with surrounding whitespace inside the fence', () => {
    // The structural check trims before inspecting first/last chars, so
    // padding inside the fence must not defeat detection.
    const wrapped = '```\n   { "k": "v" }   \n```\n\nhi';
    expect(peelEnvelope(wrapped)).toBe('hi');
  });

  it('peels a balanced JSON array body', () => {
    const wrapped = '```\n[1, 2, 3]\n```\n\nhi';
    expect(peelEnvelope(wrapped)).toBe('hi');
  });

  it('does not peel a fence whose body is only whitespace', () => {
    // An all-whitespace inner body trims to empty and short-circuits to false.
    const text = '```\n   \n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('does not peel JSON-ish content that is unbalanced (opens but never closes)', () => {
    // First char is `{` but last is not `}` — the bracket shortcut must not fire.
    const text = '```\n{ not really json\n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });

  it('does not peel an array opener with a non-matching closer', () => {
    // `[` opens but the last meaningful char is `}` — the disjunction fails
    // and the YAML fallback also rejects (no valid key/value lines).
    const text = '```\n[ foo: bar }\n```\n\nhi';
    expect(peelEnvelope(text)).toBe(text);
  });
});
