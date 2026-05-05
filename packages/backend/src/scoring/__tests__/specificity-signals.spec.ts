import { computeSignalBoosts } from '../specificity-signals';
import type { ScorerTool } from '../types';

/**
 * Unit coverage for the structural-signal helper. The detector-level tests
 * exercise most regexes implicitly; these target the coding-tool branch,
 * the `function.name` tool-shape branch, and the no-name fallback that the
 * higher-level tests can't reach without also triggering keyword matches.
 */
describe('computeSignalBoosts', () => {
  it('returns no boosts for plain text with no signals', () => {
    const { boosts } = computeSignalBoosts('hello world');
    expect(boosts.size).toBe(0);
  });

  describe('URL signals', () => {
    it('boosts web_browsing when the text contains a full URL', () => {
      const { boosts } = computeSignalBoosts('please open https://example.com');
      expect(boosts.get('web_browsing')).toBe(2);
    });

    it('falls back to bare-host boost when no scheme is present', () => {
      const { boosts } = computeSignalBoosts('check google.com for news');
      expect(boosts.get('web_browsing')).toBe(1);
    });

    it('prefers the stronger URL boost over the bare-host boost when both match', () => {
      // A bare host inside a full URL must not double-count — the `else if`
      // branch in computeSignalBoosts guarantees a URL path only.
      const { boosts } = computeSignalBoosts('see https://example.com for details');
      expect(boosts.get('web_browsing')).toBe(2);
    });
  });

  describe('coding structural signals', () => {
    it('boosts coding when the text contains a fenced code block with substantive body', () => {
      const body = 'const longer = "snippet that exceeds forty characters in body";';
      const { boosts } = computeSignalBoosts('here is the snippet\n```ts\n' + body + '\n```');
      expect(boosts.get('coding')).toBe(3);
    });

    it('does not boost coding for tiny envelope-style fences (#1767)', () => {
      // Empty/minimal fenced blocks (e.g. agent metadata wrappers like
      // ```json\n{}\n```) used to fire CODE_FENCE_BOOST and push every
      // wrapped prompt into coding. A fence body of <40 chars no longer
      // counts.
      const { boosts } = computeSignalBoosts('hi ```json\n{}\n```');
      expect(boosts.has('coding')).toBe(false);
    });

    it('boosts coding when the text contains a file path', () => {
      const { boosts } = computeSignalBoosts('edit src/main.ts and retry');
      // file path regex + `.ts` extension both match → accumulate boosts.
      expect(boosts.get('coding')).toBeGreaterThanOrEqual(2);
    });

    it('boosts coding when the text contains an absolute path like /src/foo', () => {
      const { boosts } = computeSignalBoosts('look at /src/foo.ts for the bug');
      expect(boosts.get('coding')).toBeGreaterThanOrEqual(2);
    });

    it('boosts coding for a bare relative path ./foo with no extension', () => {
      const { boosts } = computeSignalBoosts('cd ./foo and run it');
      expect(boosts.get('coding')).toBe(2);
    });

    it('does not boost coding for a bare slash between whitespace (e.g. "a / b")', () => {
      const { boosts } = computeSignalBoosts('divide a / b cleanly');
      // Neither the file-path nor any other coding signal should fire.
      expect(boosts.get('coding')).toBeUndefined();
    });

    it('boosts coding when the text contains a stack trace fragment', () => {
      const { boosts } = computeSignalBoosts('TypeError: cannot read property of undefined');
      expect(boosts.get('coding')).toBe(3);
    });
  });

  describe('coding tool-name signals', () => {
    it('boosts coding when a tool name matches a known coding tool (flat name)', () => {
      const tools: ScorerTool[] = [{ name: 'apply_patch' }];
      const { boosts } = computeSignalBoosts('x', tools);
      expect(boosts.get('coding')).toBe(1);
    });

    it('boosts coding when a tool name matches via function.name', () => {
      const tools: ScorerTool[] = [{ function: { name: 'multiedit' } }];
      const { boosts } = computeSignalBoosts('x', tools);
      expect(boosts.get('coding')).toBe(1);
    });

    it('only applies the coding-tool boost once even with multiple matching tools', () => {
      const tools: ScorerTool[] = [
        { name: 'apply_patch' },
        { name: 'str_replace' },
        { name: 'multiedit' },
      ];
      const { boosts } = computeSignalBoosts('x', tools);
      // Loop short-circuits after the first coding tool — stays at CODING_TOOL_BOOST (1).
      expect(boosts.get('coding')).toBe(1);
    });

    it('does not boost coding for generic agent tools like read/write/edit (#1767)', () => {
      // These tool names ship with every modern agent CLI and were
      // misclassifying every prompt as coding. They were removed from
      // CODING_TOOL_NAMES; the only legitimate coding signal from tools
      // alone is now a uniquely-coding tool (apply_patch, str_replace, etc).
      const tools: ScorerTool[] = [
        { name: 'read' },
        { name: 'write' },
        { name: 'edit' },
        { name: 'bash' },
        { name: 'grep' },
        { name: 'glob' },
      ];
      const { boosts } = computeSignalBoosts('x', tools);
      expect(boosts.has('coding')).toBe(false);
    });

    it('ignores tools whose name is not in the coding tool set', () => {
      const tools: ScorerTool[] = [{ name: 'browser_navigate' }];
      const { boosts } = computeSignalBoosts('x', tools);
      expect(boosts.has('coding')).toBe(false);
    });

    it('skips tools without a resolvable name', () => {
      const tools: ScorerTool[] = [{ description: 'nameless tool' }];
      const { boosts } = computeSignalBoosts('x', tools);
      expect(boosts.size).toBe(0);
    });

    it('skips tools whose function block has no name field', () => {
      const tools: ScorerTool[] = [{ function: { description: 'no name here' } }];
      const { boosts } = computeSignalBoosts('x', tools);
      expect(boosts.size).toBe(0);
    });

    it('treats a tools array that is undefined the same as empty', () => {
      const { boosts } = computeSignalBoosts('plain text', undefined);
      expect(boosts.size).toBe(0);
    });
  });
});
