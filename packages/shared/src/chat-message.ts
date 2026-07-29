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
  function?: { name?: string; description?: string; parameters?: unknown };
}

export interface RecordedResponseBody {
  type?: 'json' | 'stream';
  body?: unknown;
  raw_sse?: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeRole(role: unknown): Role {
  if (role === 'system' || role === 'user' || role === 'assistant' || role === 'tool') return role;
  if (role === 'model') return 'assistant';
  return 'unknown';
}

export function coerceContentToText(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!isRecord(part)) return typeof part === 'string' ? part : '';
        if (typeof part.text === 'string') return part.text;
        if (part.type === 'image_url' || part.type === 'input_image' || part.type === 'image') {
          return '[image]';
        }
        if (part.type === 'tool_result' && part.content != null) {
          return coerceContentToText(part.content);
        }
        if (isRecord(part.functionResponse)) {
          return prettyCompact(part.functionResponse.response);
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return prettyCompact(content);
}

function prettyCompact(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function systemMessages(value: unknown): ChatMessage[] {
  const content = coerceContentToText(value);
  return content ? [{ role: 'system', content }] : [];
}

function anthropicMessage(message: JsonRecord): ChatMessage[] {
  const role = typeof message.role === 'string' ? message.role : 'unknown';
  // Callers only route array-form Anthropic content here.
  const content = message.content as unknown[];
  const toolCalls: ToolCall[] = [];
  const normalContent: unknown[] = [];
  const toolResults: ChatMessage[] = [];

  for (const block of content) {
    if (!isRecord(block)) {
      normalContent.push(block);
      continue;
    }
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: typeof block.id === 'string' ? block.id : undefined,
        type: 'function',
        function: {
          name: typeof block.name === 'string' ? block.name : undefined,
          arguments: block.input,
        },
      });
    } else if (block.type === 'tool_result') {
      toolResults.push({
        role: 'tool',
        tool_call_id: typeof block.tool_use_id === 'string' ? block.tool_use_id : undefined,
        content: block.content,
      });
    } else {
      normalContent.push(block);
    }
  }

  const result: ChatMessage[] = [];
  if (normalContent.length > 0 || toolCalls.length > 0) {
    result.push({
      role,
      content: normalContent.length > 0 ? normalContent : null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });
  }
  return [...result, ...toolResults];
}

function responsesItem(item: JsonRecord, defaultRole: string): ChatMessage[] {
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
              arguments: item.arguments ?? '{}',
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
        content: item.output ?? '',
      },
    ];
  }
  if (item.type && item.type !== 'message') return [];
  return [
    {
      role: typeof item.role === 'string' ? item.role : defaultRole,
      content: item.content,
    },
  ];
}

function geminiContents(contents: unknown[]): ChatMessage[] {
  return contents.filter(isRecord).map((content) => ({
    role:
      content.role === 'model'
        ? 'assistant'
        : typeof content.role === 'string'
          ? content.role
          : 'user',
    content: content.parts,
  }));
}

export function extractRequestMessages(
  requestBody: Record<string, unknown> | null | undefined,
): ChatMessage[] {
  if (!requestBody) return [];
  const messages: ChatMessage[] = [];

  if (requestBody.system != null) messages.push(...systemMessages(requestBody.system));
  if (typeof requestBody.instructions === 'string' && requestBody.instructions.trim()) {
    messages.push({ role: 'system', content: requestBody.instructions });
  }

  if (Array.isArray(requestBody.messages)) {
    for (const message of requestBody.messages) {
      if (!isRecord(message)) continue;
      if (Array.isArray(message.content)) messages.push(...anthropicMessage(message));
      else messages.push(message as ChatMessage);
    }
    return messages;
  }

  if (typeof requestBody.input === 'string') {
    messages.push({ role: 'user', content: requestBody.input });
  } else if (Array.isArray(requestBody.input)) {
    for (const item of requestBody.input) {
      if (typeof item === 'string') messages.push({ role: 'user', content: item });
      else if (isRecord(item)) messages.push(...responsesItem(item, 'user'));
    }
  } else if (Array.isArray(requestBody.contents)) {
    messages.push(...geminiContents(requestBody.contents));
  }

  return messages;
}

export function extractRequestTools(
  requestBody: Record<string, unknown> | null | undefined,
): ChatTool[] {
  if (!Array.isArray(requestBody?.tools)) return [];
  return requestBody.tools.filter(isRecord).map((tool) => {
    if (isRecord(tool.function)) {
      return {
        type: typeof tool.type === 'string' ? tool.type : 'function',
        function: {
          name: typeof tool.function.name === 'string' ? tool.function.name : undefined,
          description:
            typeof tool.function.description === 'string' ? tool.function.description : undefined,
          parameters: tool.function.parameters,
        },
      };
    }
    return {
      type: typeof tool.type === 'string' ? tool.type : 'function',
      function: {
        name: typeof tool.name === 'string' ? tool.name : undefined,
        description: typeof tool.description === 'string' ? tool.description : undefined,
        parameters: tool.input_schema ?? tool.parameters,
      },
    };
  });
}

function extractJsonResponse(body: JsonRecord): ChatMessage[] {
  if (Array.isArray(body.choices)) {
    const choice = body.choices.find(isRecord);
    return choice && isRecord(choice.message) ? [choice.message as ChatMessage] : [];
  }
  if (Array.isArray(body.output)) {
    return body.output.filter(isRecord).flatMap((item) => responsesItem(item, 'assistant'));
  }
  if (body.type === 'message' && Array.isArray(body.content)) {
    return anthropicMessage({ role: body.role ?? 'assistant', content: body.content });
  }
  if (Array.isArray(body.candidates)) {
    const candidate = body.candidates.find(isRecord);
    return candidate && isRecord(candidate.content)
      ? geminiContents([{ ...candidate.content, role: 'model' }])
      : [];
  }
  return [];
}

function extractStreamResponse(rawSse: string): ChatMessage[] {
  let text = '';
  for (const line of rawSse.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const payload = JSON.parse(data) as JsonRecord;
      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const choice = choices.find(isRecord);
      const delta = choice && isRecord(choice.delta) ? choice.delta : undefined;
      if (typeof delta?.content === 'string') text += delta.content;
      if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
        text += payload.delta;
      }
      if (payload.type === 'content_block_delta' && isRecord(payload.delta)) {
        if (typeof payload.delta.text === 'string') text += payload.delta.text;
      }
    } catch {
      // Keep parsing later events when one provider emits a non-JSON line.
    }
  }
  return text ? [{ role: 'assistant', content: text }] : [];
}

export function extractResponseMessages(
  responseBody: RecordedResponseBody | null | undefined,
): ChatMessage[] {
  if (responseBody?.type === 'stream' && responseBody.raw_sse) {
    return extractStreamResponse(responseBody.raw_sse);
  }
  return responseBody?.type === 'json' && isRecord(responseBody.body)
    ? extractJsonResponse(responseBody.body)
    : [];
}

export function extractRecordedConversationMessages(
  requestBody: Record<string, unknown> | null | undefined,
  responseBody: RecordedResponseBody | null | undefined,
): ChatMessage[] {
  return [...extractRequestMessages(requestBody), ...extractResponseMessages(responseBody)];
}
