/**
 * Strip a leading agent metadata wrapper from a user message before scoring.
 *
 * Modern agents (OpenClaw, NanoBot, Hermes, etc.) wrap the human's prompt
 * in a structured envelope. A typical OpenClaw user message looks like:
 *
 *     Sender (untrusted metadata):
 *     ```json
 *     { "label": "openclaw-tui", "id": "openclaw-tui" }
 *     ```
 *
 *     say hello
 *
 * The scorer must score the human's intent, not the envelope. Without
 * peeling, "say hello" sails past the short-message shortcut (it's now
 * 100+ chars), the trie matches `json`/`metadata` as technical vocabulary,
 * the leading code fence triggers the coding-specificity boost, and the
 * request misroutes to standard/complex (#1766) and to coding (#1767).
 *
 * The peeler errs on the side of NOT peeling: if the structure doesn't
 * unambiguously look like an envelope, the original text is returned.
 */

const ENVELOPE_HEADER_REGEX =
  /^\s*[^\n]{0,120}?(?:metadata|sender|envelope|context|system message)[^\n]{0,80}:\s*\n/i;
const FENCE_LANGUAGE_REGEX = /^```([a-z+_-]*)\n([\s\S]*?)\n```/;
const STRUCTURED_LANGUAGES = new Set(['json', 'jsonl', 'yaml', 'yml', 'toml', 'xml']);

/**
 * Returns the human portion of a wrapped user message, or the original
 * text unchanged when no envelope is detected.
 */
export function peelEnvelope(text: string): string {
  if (text.length === 0) return text;

  let working = text;
  const headerMatch = working.match(ENVELOPE_HEADER_REGEX);
  if (headerMatch) {
    working = working.slice(headerMatch[0].length);
  }

  const trimmed = working.replace(/^\s+/, '');
  const fenceMatch = trimmed.match(FENCE_LANGUAGE_REGEX);
  if (!fenceMatch) {
    // Header without a fenced block isn't a recognizable envelope shape.
    return text;
  }

  const language = fenceMatch[1].toLowerCase();
  const inner = fenceMatch[2];
  const isStructured = STRUCTURED_LANGUAGES.has(language) || looksLikeStructuredData(inner);
  if (!isStructured) {
    // A code fence wrapping actual code is the legitimate "user pasted code"
    // case. Leave it for the scorer to see.
    return text;
  }

  const afterFence = trimmed.slice(fenceMatch[0].length);
  const trailing = afterFence.replace(/^\s+/, '');
  if (trailing.length === 0) {
    // No human prompt after the envelope — keep the original so the scorer
    // can still see what arrived.
    return text;
  }

  return trailing;
}

/**
 * Cheap structural check for JSON/YAML-shaped fence bodies that arrived
 * without a language hint. Avoids parsing — we only need to know whether
 * peeling is safe.
 */
function looksLikeStructuredData(inner: string): boolean {
  const stripped = inner.trim();
  if (stripped.length === 0) return false;

  const first = stripped[0];
  const last = stripped[stripped.length - 1];
  if ((first === '{' && last === '}') || (first === '[' && last === ']')) return true;

  // YAML front-matter style: every non-empty line is `key: value` or a list item.
  const lines = stripped.split('\n');
  let yamlLines = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t.length === 0) continue;
    if (/^[A-Za-z_][\w.-]*\s*:\s*\S/.test(t) || /^- /.test(t)) {
      yamlLines++;
    } else {
      return false;
    }
  }
  return yamlLines >= 2;
}
