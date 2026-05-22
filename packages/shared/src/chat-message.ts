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

type JsonRecord = Record<string, unknown>;
type RecordingResponseBody = { type?: string; body?: unknown };

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeRole(role: unknown): Role {
  if (role === 'system' || role === 'user' || role === 'assistant' || role === 'tool') return role;
  return 'unknown';
}

export function coerceContentToText(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === 'object') {
          const p = part as { text?: unknown; type?: unknown };
          if (typeof p.text === 'string') return p.text;
          if (p.type === 'image_url' || p.type === 'input_image') return '[image]';
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

function responsesContentToChatContent(content: unknown, role: string): unknown {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;

  const converted = content.filter(isRecord).map((part) => {
    if (typeof part.text === 'string') {
      return { type: 'text', text: part.text };
    }
    if (part.type === 'input_image' && typeof part.image_url === 'string') {
      return { type: 'image_url', image_url: { url: part.image_url } };
    }
    return part;
  });

  if (converted.length === 1 && converted[0]?.type === 'text' && role !== 'assistant') {
    return converted[0].text;
  }
  return converted;
}

function responsesInputItemToMessages(item: JsonRecord): ChatMessage[] {
  if (item.type === 'function_call') {
    return [
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: typeof item.call_id === 'string' ? item.call_id : undefined,
            type: 'function',
            function: {
              name: typeof item.name === 'string' ? item.name : 'unknown',
              arguments: typeof item.arguments === 'string' ? item.arguments : '{}',
            },
          },
        ],
      },
    ];
  }

  if (item.type === 'function_call_output') {
    return [
      {
        role: 'tool',
        tool_call_id: typeof item.call_id === 'string' ? item.call_id : undefined,
        content:
          item.output == null
            ? ''
            : typeof item.output === 'string'
              ? item.output
              : JSON.stringify(item.output),
      },
    ];
  }

  const role = typeof item.role === 'string' ? item.role : 'user';
  return [{ role, content: responsesContentToChatContent(item.content, role) }];
}

function responsesOutputItemToMessages(item: JsonRecord): ChatMessage[] {
  if (item.type === 'function_call') {
    return [
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id:
              typeof item.call_id === 'string'
                ? item.call_id
                : typeof item.id === 'string'
                  ? item.id
                  : undefined,
            type: 'function',
            function: {
              name: typeof item.name === 'string' ? item.name : 'unknown',
              arguments: typeof item.arguments === 'string' ? item.arguments : '{}',
            },
          },
        ],
      },
    ];
  }

  if (item.type !== 'message') return [];

  const role = typeof item.role === 'string' ? item.role : 'assistant';
  return [{ role, content: responsesContentToChatContent(item.content, role) }];
}

export function extractRequestMessages(
  requestBody: Record<string, unknown> | null | undefined,
): ChatMessage[] {
  if (!requestBody) return [];
  const rb = requestBody as { messages?: ChatMessage[]; input?: unknown; instructions?: unknown };
  if (Array.isArray(rb.messages)) return rb.messages;

  const messages: ChatMessage[] = [];
  if (typeof rb.instructions === 'string' && rb.instructions.trim()) {
    messages.push({ role: 'system', content: rb.instructions });
  }

  if (typeof rb.input === 'string') {
    messages.push({ role: 'user', content: rb.input });
  } else if (Array.isArray(rb.input)) {
    for (const item of rb.input) {
      if (typeof item === 'string') {
        messages.push({ role: 'user', content: item });
      } else if (isRecord(item)) {
        messages.push(...responsesInputItemToMessages(item));
      }
    }
  }

  return messages;
}

export function extractRequestTools(
  requestBody: Record<string, unknown> | null | undefined,
): ChatTool[] {
  const rb = requestBody as { tools?: unknown[] } | null | undefined;
  if (!Array.isArray(rb?.tools)) return [];
  return rb.tools.filter(isRecord).map((tool) => {
    if (isRecord(tool.function)) return tool as ChatTool;
    if (tool.type === 'function') {
      return {
        type: 'function',
        function: {
          name: typeof tool.name === 'string' ? tool.name : undefined,
          description: typeof tool.description === 'string' ? tool.description : undefined,
        },
      };
    }
    return {
      type: typeof tool.type === 'string' ? tool.type : undefined,
      function: { name: typeof tool.type === 'string' ? tool.type : undefined },
    };
  });
}

export type RequestBodyFormat = 'openai' | 'claude' | 'gemini' | 'empty' | 'unknown';

/**
 * The drawer renders OpenAI chat-completion and Responses request shapes
 * inline; Claude/Gemini payloads route to the Raw tab. Returning
 * `empty`/`unknown` lets callers surface a hint instead of silently rendering
 * zero turns.
 */
export function detectRequestBodyFormat(
  requestBody: Record<string, unknown> | null | undefined,
): RequestBodyFormat {
  if (!requestBody) return 'empty';
  if (Array.isArray((requestBody as { messages?: unknown }).messages)) return 'openai';
  const input = (requestBody as { input?: unknown }).input;
  if (typeof input === 'string' || Array.isArray(input)) return 'openai';
  if (Array.isArray((requestBody as { contents?: unknown }).contents)) return 'gemini';
  if (typeof (requestBody as { system?: unknown }).system === 'string') return 'claude';
  return 'unknown';
}

export function extractAssistantReply(
  responseBody: RecordingResponseBody | null | undefined,
): ChatMessage | null {
  return (
    extractResponseMessages(responseBody).find((m) => normalizeRole(m.role) === 'assistant') ?? null
  );
}

export function extractResponseMessages(
  responseBody: RecordingResponseBody | null | undefined,
): ChatMessage[] {
  if (!responseBody || responseBody.type !== 'json' || !isRecord(responseBody.body)) return [];

  const body = responseBody.body;
  if (Array.isArray(body.choices)) {
    for (const choice of body.choices) {
      if (!isRecord(choice) || !isRecord(choice.message)) continue;
      return [choice.message as ChatMessage];
    }
    return [];
  }

  if (!Array.isArray(body.output)) return [];

  const messages: ChatMessage[] = [];
  for (const item of body.output) {
    if (isRecord(item)) messages.push(...responsesOutputItemToMessages(item));
  }
  return messages;
}

export function extractRecordedConversationMessages(
  requestBody: Record<string, unknown> | null | undefined,
  responseBody: RecordingResponseBody | null | undefined,
): ChatMessage[] {
  const requestMessages = extractRequestMessages(requestBody);
  if (detectRequestBodyFormat(requestBody) !== 'openai') return requestMessages;
  return [...requestMessages, ...extractResponseMessages(responseBody)];
}
