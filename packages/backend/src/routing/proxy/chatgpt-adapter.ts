/**
 * Converts between OpenAI Chat Completions format and the
 * ChatGPT Codex Responses API format used by subscription tokens.
 *
 * Endpoint: POST https://chatgpt.com/backend-api/codex/responses
 */

import { randomUUID } from 'crypto';

const DEFAULT_INSTRUCTIONS = 'You are a helpful assistant.';

interface OpenAiMessage {
  role: string;
  content: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
}

/* ── Request conversion ── */

export function toResponsesRequest(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const messages = (body.messages ?? []) as OpenAiMessage[];
  const input: Record<string, unknown>[] = [];

  for (const message of messages) {
    if (message.role === 'system' || message.role === 'developer') {
      continue;
    }

    if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      const assistantText = extractTextContent(message.content);
      if (assistantText) {
        input.push({
          role: 'assistant',
          content: convertContent(assistantText, 'assistant'),
        });
      }
      input.push(...convertAssistantToolCalls(message.tool_calls));
      continue;
    }

    if (message.role === 'tool' || message.role === 'function') {
      input.push({
        type: 'function_call_output',
        call_id: typeof message.tool_call_id === 'string' ? message.tool_call_id : randomUUID(),
        output: extractTextContent(message.content) ?? JSON.stringify(message.content ?? ''),
      });
      continue;
    }

    input.push({
      role: message.role,
      content: convertContent(message.content, message.role),
    });
  }

  const request: Record<string, unknown> = {
    model,
    input,
    stream: body.stream !== false,
    store: false,
    instructions: extractInstructions(messages),
  };

  if (Array.isArray(body.tools)) {
    request.tools = convertTools(body.tools as Record<string, unknown>[]);
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
  const toolCalls: { id: string; type: string; function: { name: string; arguments: string } }[] =
    [];

  for (const item of output) {
    if (item.type === 'message') {
      const content = item.content as { type?: string; text?: string }[] | undefined;
      if (!content) continue;
      for (const part of content) {
        if (part.type === 'output_text' && part.text) text += part.text;
      }
      continue;
    }

    if (item.type === 'function_call') {
      toolCalls.push({
        id: (item.call_id as string) ?? randomUUID(),
        type: 'function',
        function: {
          name: (item.name as string) ?? '',
          arguments: (item.arguments as string) ?? '{}',
        },
      });
    }
  }

  const usage = (data.usage as Record<string, unknown>) ?? {};
  const inputDetails = usage.input_tokens_details as Record<string, number> | undefined;

  const message: Record<string, unknown> = {
    role: 'assistant',
    content: text || null,
  };

  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return {
    id: `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 29)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      },
    ],
    usage: {
      prompt_tokens: (usage.input_tokens as number) ?? 0,
      completion_tokens: (usage.output_tokens as number) ?? 0,
      total_tokens: (usage.total_tokens as number) ?? 0,
      cache_read_tokens: inputDetails?.cached_tokens ?? 0,
      cache_creation_tokens: 0,
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

  if (eventType === 'response.output_text.delta') {
    const data = safeParse(dataStr);
    if (!data) return null;
    const delta = typeof data.delta === 'string' ? data.delta : '';
    return formatSSE({ delta: { content: delta }, finish_reason: null }, model);
  }

  if (eventType === 'response.function_call_arguments.delta') {
    const data = safeParse(dataStr);
    if (!data) return null;
    const delta = typeof data.delta === 'string' ? data.delta : '';
    return formatSSE(
      {
        delta: {
          tool_calls: [
            {
              index: typeof data.output_index === 'number' ? data.output_index : 0,
              function: { arguments: delta },
            },
          ],
        },
        finish_reason: null,
      },
      model,
    );
  }

  if (eventType === 'response.output_item.added') {
    const data = safeParse(dataStr);
    if (!data) return null;
    const item = isObjectRecord(data.item) ? data.item : undefined;
    if (item?.type !== 'function_call') return null;
    return formatSSE(
      {
        delta: {
          tool_calls: [
            {
              index: typeof data.output_index === 'number' ? data.output_index : 0,
              id: (item.call_id as string) ?? '',
              type: 'function',
              function: { name: (item.name as string) ?? '', arguments: '' },
            },
          ],
        },
        finish_reason: null,
      },
      model,
    );
  }

  if (eventType === 'response.completed') {
    const data = safeParse(dataStr);
    const response = isObjectRecord(data?.response) ? data.response : undefined;
    const responseUsage = response?.usage as Record<string, number> | undefined;
    const responseUsageDetails = response?.usage as Record<string, unknown> | undefined;
    const cachedTokens =
      (responseUsageDetails?.input_tokens_details as Record<string, number> | undefined)
        ?.cached_tokens ?? 0;

    const usage = responseUsage
      ? {
          prompt_tokens: responseUsage.input_tokens ?? 0,
          completion_tokens: responseUsage.output_tokens ?? 0,
          total_tokens: responseUsage.total_tokens ?? 0,
          cache_read_tokens: cachedTokens,
          cache_creation_tokens: 0,
        }
      : undefined;

    const responseOutput = Array.isArray(response?.output)
      ? (response.output as Array<{ type?: string }>)
      : [];
    const hasFunctionCalls = responseOutput.some((item) => item.type === 'function_call');
    const finish = formatSSE(
      { delta: {}, finish_reason: hasFunctionCalls ? 'tool_calls' : 'stop' },
      model,
      usage,
    );
    return `${finish}\ndata: [DONE]\n\n`;
  }

  return null;
}

/* ── Helpers ── */

function convertAssistantToolCalls(toolCalls: unknown[]): Record<string, unknown>[] {
  return toolCalls.flatMap((toolCall) => {
    if (!isObjectRecord(toolCall) || !isObjectRecord(toolCall.function)) {
      return [];
    }

    return [
      {
        type: 'function_call',
        call_id: typeof toolCall.id === 'string' ? toolCall.id : randomUUID(),
        name: typeof toolCall.function.name === 'string' ? toolCall.function.name : 'unknown',
        arguments:
          typeof toolCall.function.arguments === 'string' ? toolCall.function.arguments : '{}',
      },
    ];
  });
}

function convertTools(tools: Record<string, unknown>[]): Record<string, unknown>[] {
  return tools.map((tool) => {
    if (tool.type === 'function' && isObjectRecord(tool.function)) {
      return {
        type: 'function',
        name: tool.function.name,
        ...(tool.function.description !== undefined && { description: tool.function.description }),
        ...(tool.function.parameters !== undefined && { parameters: tool.function.parameters }),
        ...(tool.function.strict !== undefined && { strict: tool.function.strict }),
      };
    }

    return tool;
  });
}

function convertContent(content: unknown, role: string): unknown {
  const partType = role === 'assistant' ? 'output_text' : 'input_text';

  if (content === null || content === undefined) {
    return [{ type: partType, text: '' }];
  }

  if (typeof content === 'string') {
    return [{ type: partType, text: content }];
  }

  if (!Array.isArray(content)) return content;

  return (content as { type?: string; text?: string }[]).map((part) => {
    if (part.type === 'text') return { ...part, type: partType };
    return part;
  });
}

function extractInstructions(messages: OpenAiMessage[]): string {
  const instructions = messages
    .filter((message) => message.role === 'system' || message.role === 'developer')
    .map((message) => extractTextContent(message.content))
    .filter((content): content is string => Boolean(content))
    .map((content) => content.trim())
    .filter(Boolean)
    .join('\n\n');

  return instructions || DEFAULT_INSTRUCTIONS;
}

function extractTextContent(content: unknown): string | null {
  if (typeof content === 'string') return content || null;
  if (!Array.isArray(content)) return null;

  const text = content
    .filter(isObjectRecord)
    .map((part) => {
      if (!isTextPart(part.type) || typeof part.text !== 'string') return '';
      return part.text;
    })
    .join('');

  return text || null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTextPart(type: unknown): boolean {
  return type === 'text' || type === 'input_text' || type === 'output_text';
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
    id: `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 29)}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, ...choice }],
  };
  if (usage) payload.usage = usage;
  return `data: ${JSON.stringify(payload)}\n\n`;
}
