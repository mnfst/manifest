/**
 * Wire-format helpers for the OpenAI-compatible chat completion request body
 * that Manifest records + replays. Kept in the shared package because both
 * the backend (benchmark service, recording viewer) and the frontend
 * (recorded-message drawer, benchmark replay) reach into the same shape.
 */

export type Role = 'system' | 'user' | 'assistant' | 'tool' | 'unknown';

export interface ToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: unknown };
}

export interface ChatMessage {
  role?: string;
  content?: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ChatTool {
  type?: string;
  function?: { name?: string; description?: string };
}

export function normalizeRole(role: unknown): Role {
  if (role === 'system' || role === 'user' || role === 'assistant' || role === 'tool') return role;
  return 'unknown';
}

/** Coerce any message content (string, array-of-parts, opaque object) into a flat string. */
export function coerceContentToText(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === 'object') {
          const p = part as { text?: unknown; type?: unknown };
          if (typeof p.text === 'string') return p.text;
          if (p.type === 'image_url') return '[image]';
        }
        return '';
      })
      .join('\n')
      .trim();
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

/** Pull the chat-completion messages array out of a recorded request_body. */
export function extractRequestMessages(
  requestBody: Record<string, unknown> | null | undefined,
): ChatMessage[] {
  const rb = requestBody as { messages?: ChatMessage[] } | null | undefined;
  return Array.isArray(rb?.messages) ? rb!.messages! : [];
}

/** Pull the tools array out of a recorded request_body. */
export function extractRequestTools(
  requestBody: Record<string, unknown> | null | undefined,
): ChatTool[] {
  const rb = requestBody as { tools?: ChatTool[] } | null | undefined;
  return Array.isArray(rb?.tools) ? rb!.tools! : [];
}

export type RequestBodyFormat = 'openai' | 'claude' | 'gemini' | 'empty' | 'unknown';

/**
 * Classify the wire format of a recorded request body. We only render
 * `openai` (chat-completion-shaped) turns inline — for Claude native /
 * Gemini shapes, the drawer surfaces a "switch to Raw tab" hint rather
 * than silently rendering 0 turns.
 */
export function detectRequestBodyFormat(
  requestBody: Record<string, unknown> | null | undefined,
): RequestBodyFormat {
  if (!requestBody) return 'empty';
  if (Array.isArray((requestBody as { messages?: unknown }).messages)) return 'openai';
  if (Array.isArray((requestBody as { contents?: unknown }).contents)) return 'gemini';
  if (typeof (requestBody as { system?: unknown }).system === 'string') return 'claude';
  return 'unknown';
}

/** Pull the assistant message from choices[0] of a recorded `type: 'json'` response. */
export function extractAssistantReply(
  responseBody: { type?: string; body?: unknown } | null | undefined,
): ChatMessage | null {
  if (!responseBody || responseBody.type !== 'json') return null;
  const chat = (responseBody as { body?: unknown }).body as
    | { choices?: Array<{ message?: ChatMessage }> }
    | null
    | undefined;
  return chat?.choices?.[0]?.message ?? null;
}
