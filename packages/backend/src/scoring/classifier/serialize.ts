/**
 * Request serializer — exact TypeScript port of `clean-real-requests.py`
 * (scrub + build_cleaned). The classifier was trained on this text shape;
 * production inference MUST serialize requests with this same function.
 */

export interface ChatMessage {
  role?: string;
  content?: unknown;
  tool_calls?: Array<{ function?: { name?: string } }>;
}

export interface ChatRequest {
  model?: string;
  max_tokens?: number | null;
  tool_choice?: unknown;
  messages?: ChatMessage[];
  tools?: Array<{ function?: { name?: string }; name?: string }>;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URLCRED = /(https?:\/\/)[^/\s:@"']+:[^/\s@"']+@/g;
const USERPATH = /(\/(?:Users|home))\/[^/\s"']+/g;
const WINPATH = /([A-Za-z]:\\Users\\)[^\\\s"']+/gi;
const SECRET_KV =
  /\b(api[_-]?key|secret|token|password|passwd|authorization|bearer|client[_-]?secret|access[_-]?token|refresh[_-]?token)("?\s*[:=]\s*"?|\s+)([A-Za-z0-9._-]{8,})/gi;
const SK_KEY = /\b(sk|pk|rk|ghp|gho|xoxb|xoxp|AKIA)[-_][A-Za-z0-9_-]{12,}\b/g;
const OPENAI_ID = /\b(resp|sess|msg|run|thread|call|chatcmpl|asst|file|ev)_[A-Za-z0-9]{12,}\b/g;
const LONGHEX = /\b[0-9a-f]{24,}\b/gi;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const LONGNUM = /\b\d{12,}\b/g;

export function scrub(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL, '<EMAIL>')
    .replace(URLCRED, '$1<CRED>@')
    .replace(USERPATH, '$1/<USER>')
    .replace(WINPATH, '$1<USER>')
    .replace(SECRET_KV, '$1$2<SECRET>')
    .replace(SK_KEY, '<SECRET>')
    .replace(OPENAI_ID, '<ID>')
    .replace(LONGHEX, '<HEX>')
    .replace(IPV4, '<IP>')
    .replace(LONGNUM, '<NUM>');
}

function contentToText(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const p of content) {
      if (typeof p === 'string') parts.push(p);
      else if (Array.isArray(p)) parts.push(contentToText(p));
      else if (p && typeof p === 'object') {
        const o = p as Record<string, unknown>;
        if (o.type === 'image_url' || 'image_url' in o) parts.push('[image]');
        else parts.push(contentToText(o.text ?? o.content ?? ''));
      }
    }
    return parts.filter(Boolean).join('\n');
  }
  return String(content);
}

function normMessage(msg: ChatMessage): [string, string] {
  const role = msg.role ?? 'unknown';
  let text = contentToText(msg.content);
  if (!text && msg.tool_calls) {
    const names = msg.tool_calls
      .map((tc) => tc?.function?.name)
      .filter((n): n is string => Boolean(n));
    text = names.length ? `[calls: ${names.join(', ')}]` : '[tool_call]';
  }
  return [role, scrub(text)];
}

function cap(text: string, limit: number): string {
  const t = (text || '').split(/\s+/).filter(Boolean).join(' ');
  return t.length > limit ? t.slice(0, limit) + ' …' : t;
}

/** Python-style rendering of META scalar values (None for null/undefined). */
function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function serializeRequest(rb: ChatRequest, keepLast = 8, maxSerialized = 3800): string {
  const msgs = rb.messages ?? [];
  const nonSystem = msgs.filter((m) => m.role !== 'system');
  const sysMsg = msgs.find((m) => m.role === 'system');

  const users = nonSystem.filter((m) => m.role === 'user');
  const latestUser = users.length ? users[users.length - 1] : undefined;
  const firstUser = users.length ? users[0] : undefined;

  const toolsIn = rb.tools ?? [];
  const toolNames: string[] = [];
  for (const tool of toolsIn) {
    const name = tool?.function?.name ?? tool?.name;
    if (name) toolNames.push(name);
  }

  const recent: Array<[string, string]> = [];
  for (const m of nonSystem.slice(-keepLast)) {
    if (m === latestUser) continue;
    const [role, t] = normMessage(m);
    if (t) recent.push([role, cap(t, 220)]);
  }

  const parts: string[] = [
    `META: turns=${msgs.length} tools=${toolsIn.length} ` +
      `max_tokens=${pyRepr(rb.max_tokens)} tool_choice=${pyRepr(rb.tool_choice)}`,
  ];
  if (toolNames.length) parts.push('TOOLS: ' + toolNames.slice(0, 45).join(', '));
  if (latestUser) parts.push('LATEST_USER: ' + cap(normMessage(latestUser)[1], 900));
  if (recent.length) {
    parts.push('RECENT:');
    for (const [r, t] of recent) parts.push(`  ${r.toUpperCase()}: ${t}`);
  }
  if (firstUser && firstUser !== latestUser) {
    parts.push('FIRST_USER: ' + cap(normMessage(firstUser)[1], 350));
  }
  if (sysMsg) parts.push('SYSTEM: ' + cap(normMessage(sysMsg)[1], 350));

  let serialized = parts.join('\n');
  if (serialized.length > maxSerialized) {
    serialized = serialized.slice(0, maxSerialized) + ' …';
  }
  return serialized;
}
