import type { MessageRecording } from './api.js';

interface ChatChoice {
  message?: { content?: unknown };
  delta?: { content?: unknown };
}

function extractFromOpenAiChoices(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const choices = (body as { choices?: ChatChoice[] }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const raw = choices[0]?.message?.content;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

/**
 * Concatenate assistant content deltas from an OpenAI-style SSE stream.
 * Each `data: {...}` chunk contributes `choices[0].delta.content`.
 */
function extractFromSse(sse: string): string {
  let out = '';
  for (const line of sse.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const obj = JSON.parse(payload) as { choices?: ChatChoice[] };
      const delta = obj.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') out += delta;
    } catch {
      /* ignore malformed chunks */
    }
  }
  return out;
}

/**
 * Pull the assistant reply text out of a recorded response body, regardless
 * of whether the original call was streaming. Returns an empty string when
 * the recording doesn't include a parsable response — the caller can render
 * that as "no content" without a special code path.
 */
export function extractRecordedAssistantText(rb: MessageRecording['response_body']): string {
  if (!rb) return '';
  if (rb.type === 'stream') return extractFromSse(rb.raw_sse ?? '');
  if (rb.type === 'json') return extractFromOpenAiChoices(rb.body);
  return '';
}
