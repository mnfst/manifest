/**
 * Converts between OpenAI Chat Completions format and the
 * ChatGPT Codex Responses API format used by subscription tokens.
 *
 * Endpoint: POST https://chatgpt.com/backend-api/codex/responses
 */

import { randomUUID } from 'crypto';

/* ── Request conversion ── */

export function toResponsesRequest(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const messages = (body.messages ?? []) as { role: string; content: unknown }[];

  // Extract system message as instructions
  const systemMsg = messages.find((m) => m.role === 'system');
  const input = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: convertContent(m.content, m.role) }));

  const request: Record<string, unknown> = {
    model,
    input,
    stream: true,
    store: false,
  };

  if (systemMsg && typeof systemMsg.content === 'string') {
    request.instructions = systemMsg.content;
  }

  return request;
}

/* ── Non-streaming response conversion ── */

export function fromResponsesResponse(
  data: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const output = (data.output ?? []) as Record<string, unknown>[];
  let text = '';

  for (const item of output) {
    if (item.type !== 'message') continue;
    const content = item.content as { type?: string; text?: string }[] | undefined;
    if (!content) continue;
    for (const part of content) {
      if (part.type === 'output_text' && part.text) text += part.text;
    }
  }

  const usage = (data.usage as Record<string, number>) ?? {};

  return {
    id: `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 29)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: usage.input_tokens ?? 0,
      completion_tokens: usage.output_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0,
    },
  };
}

/* ── Streaming SSE conversion ── */

/**
 * Transform a single Responses API SSE chunk into an OpenAI
 * Chat Completions SSE chunk. Returns null for irrelevant events.
 */
export function transformResponsesStreamChunk(chunk: string, model: string): string | null {
  // parseSseEvents strips "data: " prefixes before calling transforms,
  // so lines arrive as "event: <type>\n<json>" (no "data: " prefix on JSON).
  const lines = chunk.split('\n');
  let eventType = '';
  let dataStr = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      dataStr = line.slice(6);
    } else if (line.trim()) {
      // Pre-processed: data prefix already stripped by parseSseEvents
      dataStr = line.trim();
    }
  }

  if (!eventType && !dataStr) return null;

  // Text delta — the main content event
  if (eventType === 'response.output_text.delta') {
    const data = safeParse(dataStr);
    if (!data) return null;
    const delta = typeof data.delta === 'string' ? data.delta : '';
    return formatSSE({ delta: { content: delta }, finish_reason: null }, model);
  }

  // Response completed — send finish_reason with usage, then [DONE]
  if (eventType === 'response.completed') {
    const data = safeParse(dataStr);
    const respUsage = (data?.response as Record<string, unknown>)?.usage as
      | Record<string, number>
      | undefined;
    const usage = respUsage
      ? {
          prompt_tokens: respUsage.input_tokens ?? 0,
          completion_tokens: respUsage.output_tokens ?? 0,
          total_tokens: respUsage.total_tokens ?? 0,
        }
      : undefined;
    const finish = formatSSE({ delta: {}, finish_reason: 'stop' }, model, usage);
    return `${finish}\ndata: [DONE]\n\n`;
  }

  return null;
}

/* ── Helpers ── */

/**
 * Convert Chat Completions content to Responses API content format.
 * The Responses API uses role-specific content types:
 * - user messages: `input_text`
 * - assistant messages: `output_text`
 */
function convertContent(content: unknown, role: string): unknown {
  const partType = role === 'assistant' ? 'output_text' : 'input_text';
  if (typeof content === 'string') {
    return [{ type: partType, text: content }];
  }
  if (!Array.isArray(content)) return content;
  return (content as { type?: string; text?: string }[]).map((part) => {
    if (part.type === 'text') return { ...part, type: partType };
    return part;
  });
}

function safeParse(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatSSE(
  choice: Record<string, unknown>,
  model: string,
  usage?: Record<string, number>,
): string {
  const payload: Record<string, unknown> = {
    id: `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, ...choice }],
  };
  if (usage) payload.usage = usage;
  return `data: ${JSON.stringify(payload)}\n\n`;
}
