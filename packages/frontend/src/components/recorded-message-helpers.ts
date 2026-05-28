/**
 * Drawer-only helpers for the recorded-message viewer. Wire-format helpers
 * (Role, ChatMessage, coerceContentToText, extract*) live in the shared
 * package because the recorded shape mirrors the proxy contract.
 */
export {
  coerceContentToText,
  detectRequestBodyFormat,
  extractAssistantReply,
  extractRecordedConversationMessages,
  extractRequestMessages,
  extractResponseMessages,
  extractRequestTools,
  normalizeRole,
} from 'manifest-shared';
export type { ChatMessage, ChatTool, RequestBodyFormat, Role, ToolCall } from 'manifest-shared';

import { coerceContentToText, type Role } from 'manifest-shared';

export type ContentKind = 'json' | 'xml' | 'markdown' | 'text';

/**
 * Auto-detect how to render a string. Cheap heuristics over the first
 * non-whitespace chars — good enough for the recording viewer. When in doubt
 * we fall through to `text` so nothing gets mangled.
 */
export function detectContentKind(raw: string): ContentKind {
  const trimmed = raw.trim();
  if (!trimmed) return 'text';
  const first = trimmed[0];
  if (first === '{' || first === '[') {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      /* fallthrough */
    }
  }
  if (first === '<' && /<\w[\w-]*[\s>/]/.test(trimmed)) return 'xml';
  if (/```|^#{1,6}\s|\n[-*]\s|\[[^\]]+\]\([^)]+\)/m.test(trimmed)) return 'markdown';
  return 'text';
}

/**
 * Collect every XML element name that appears in the string (deduplicated,
 * in first-appearance order, capped). The name says "all" rather than "top
 * level" because we don't parse nesting — the chip row is a map of the
 * shapes a reader will encounter, not a structural outline.
 */
export function extractAllXmlTagNames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /<([a-zA-Z][\w-]*)[\s>/]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const tag = match[1]!.toLowerCase();
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 20) break;
  }
  return out;
}

/** ~4 chars per token is the classic back-of-envelope for English/code mix. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / 4));
}

/** Crop a long string to N chars without breaking mid-line where possible. */
export function oneLinePreview(raw: string, maxChars = 140): string {
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxChars) return flat;
  return flat.slice(0, maxChars - 1).trimEnd() + '…';
}

/** Heuristic: what we consider "big" enough to collapse by default. */
export const LARGE_TURN_TOKEN_THRESHOLD = 2000;

/**
 * Truthy when a turn should start collapsed. system + tool always start
 * folded; user + assistant fold only when the content is massive.
 */
export function shouldCollapseByDefault(role: Role, tokens: number): boolean {
  if (role === 'system' || role === 'tool' || role === 'unknown') return true;
  return tokens >= LARGE_TURN_TOKEN_THRESHOLD;
}

/**
 * Count occurrences of `needle` in `haystack`. Caps the result at 999 so
 * outline badges don't render like phone-number digits for pathological
 * searches ("\n" against a 200KB prompt); displayed as "999+" by the caller.
 */
export const MAX_COUNTED_MATCHES = 999;
export function countMatches(haystack: string, needle: string): number {
  if (!needle) return 0;
  let i = 0;
  let count = 0;
  while (count < MAX_COUNTED_MATCHES) {
    const hit = haystack.indexOf(needle, i);
    if (hit === -1) break;
    count++;
    i = hit + needle.length;
  }
  return count;
}

/** Preview of a message turn for the outline / compact view. */
export function buildTurnPreview(message: {
  content?: unknown;
  tool_calls?: Array<{ function?: { name?: string } }>;
}): string {
  const text = coerceContentToText(message.content);
  if (text) return oneLinePreview(text, 120);
  const calls = message.tool_calls ?? [];
  if (calls.length > 0) {
    const names = calls.map((c) => c.function?.name ?? 'unknown').join(', ');
    return `${calls.length} tool call${calls.length > 1 ? 's' : ''}: ${names}`;
  }
  return '(empty)';
}

/** Rough token estimate for a single message (content + any tool_calls args). */
export function estimateMessageTokens(message: {
  content?: unknown;
  tool_calls?: Array<{ function?: { arguments?: unknown } }>;
}): number {
  const content = coerceContentToText(message.content);
  const calls = message.tool_calls ?? [];
  const argsText = calls
    .map((c) => {
      const a = c.function?.arguments;
      if (typeof a === 'string') return a;
      if (a == null) return '';
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join('');
  return estimateTokens(content + argsText);
}
