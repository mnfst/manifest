import { scoreRequest, scanMessages } from '../index';

/**
 * Regression tests for #1766 (simple → standard/complex) and #1767 (coding
 * specificity hijack) — both triggered by agents wrapping the user prompt
 * in a metadata envelope plus shipping a generic tool kit. See the issues
 * for full root-cause analysis.
 */

const OPENCLAW_WRAPPER =
  'Sender (untrusted metadata):\n' +
  '```json\n' +
  '{ "label": "openclaw-tui", "id": "openclaw-tui" }\n' +
  '```\n\n';

const GENERIC_AGENT_TOOLS = [
  { type: 'function', function: { name: 'read' } },
  { type: 'function', function: { name: 'write' } },
  { type: 'function', function: { name: 'edit' } },
  { type: 'function', function: { name: 'bash' } },
  { type: 'function', function: { name: 'grep' } },
];

describe('agent envelope regressions', () => {
  describe('#1766 — wrapped greetings route to simple', () => {
    it('routes a wrapped "say hello" to simple via short_message', () => {
      const result = scoreRequest({
        messages: [{ role: 'user', content: OPENCLAW_WRAPPER + 'say hello' }],
      });
      expect(result.tier).toBe('simple');
      expect(result.reason).toBe('short_message');
    });

    it('routes a wrapped "hey" with tools to simple', () => {
      const result = scoreRequest({
        messages: [{ role: 'user', content: OPENCLAW_WRAPPER + 'hey' }],
        tools: GENERIC_AGENT_TOOLS,
      });
      // Tools force standard at minimum via tool_detected floor; without
      // tools it would be simple. The point is it must NOT drift to
      // complex on a wrapped greeting.
      expect(['simple', 'standard']).toContain(result.tier);
    });

    it('keeps a 6-turn wrapped greeting conversation in simple', () => {
      const turns = ['hi', 'hello', 'how are you', 'thanks', 'ok', 'say hello'];
      const messages: { role: string; content: string }[] = [];
      turns.forEach((t, i) => {
        messages.push({ role: 'user', content: OPENCLAW_WRAPPER + t });
        if (i < turns.length - 1) messages.push({ role: 'assistant', content: 'ok' });
      });
      const result = scoreRequest({ messages });
      expect(result.tier).toBe('simple');
    });
  });

  describe('#1767 — generic agent tools no longer hijack coding', () => {
    it('does not classify "hey" + read tool as coding', () => {
      expect(
        scanMessages(
          [{ role: 'user', content: 'hey' }],
          [{ type: 'function', function: { name: 'read' } }],
        ),
      ).toBeNull();
    });

    it('does not classify "hey" + the full generic agent kit as coding', () => {
      expect(scanMessages([{ role: 'user', content: 'hey' }], GENERIC_AGENT_TOOLS)).toBeNull();
    });

    it('does not classify a wrapped greeting (with code-fenced metadata) as coding', () => {
      expect(scanMessages([{ role: 'user', content: OPENCLAW_WRAPPER + 'hello' }])).toBeNull();
    });

    it('still classifies a real coding request as coding', () => {
      const result = scanMessages(
        [
          {
            role: 'user',
            content:
              'help me debug this TypeError in src/scoring/index.ts — the function returns undefined',
          },
        ],
        [{ type: 'function', function: { name: 'apply_patch' } }],
      );
      expect(result?.category).toBe('coding');
    });

    it('still classifies a uniquely-coding tool + coding keyword as coding', () => {
      const result = scanMessages(
        [{ role: 'user', content: 'apply this patch to fix the bug' }],
        [{ type: 'function', function: { name: 'apply_patch' } }],
      );
      expect(result?.category).toBe('coding');
    });
  });
});
