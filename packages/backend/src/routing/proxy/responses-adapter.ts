import { randomUUID } from 'crypto';

import { DEFAULT_INSTRUCTIONS } from './chatgpt-helpers';
import { OpenAIMessage } from './proxy-types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(isRecord)
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
}

function toChatContent(content: unknown, role: string): unknown {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;

  const converted = content.filter(isRecord).map((part) => {
    if (typeof part.text === 'string') return { type: 'text', text: part.text };
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

function responseInputItemToMessage(item: JsonRecord): OpenAIMessage[] {
  if (item.type === 'function_call') {
    return [
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: typeof item.call_id === 'string' ? item.call_id : randomUUID(),
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
        tool_call_id: typeof item.call_id === 'string' ? item.call_id : randomUUID(),
        content:
          item.output === undefined || item.output === null
            ? ''
            : typeof item.output === 'string'
              ? item.output
              : JSON.stringify(item.output),
      },
    ];
  }

  const role = typeof item.role === 'string' ? item.role : 'user';
  return [{ role, content: toChatContent(item.content, role) }];
}

export function toChatCompletionsRequest(body: JsonRecord): JsonRecord {
  const messages: OpenAIMessage[] = [];
  const instructions = body.instructions;
  if (typeof instructions === 'string' && instructions.trim()) {
    messages.push({ role: 'system', content: instructions });
  }

  const input = body.input;
  if (typeof input === 'string') {
    messages.push({ role: 'user', content: input });
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') {
        messages.push({ role: 'user', content: item });
      } else if (isRecord(item)) {
        messages.push(...responseInputItemToMessage(item));
      }
    }
  }

  const chatBody: JsonRecord = { messages };
  for (const key of [
    'model',
    'temperature',
    'top_p',
    'stream',
    'metadata',
    'store',
    'user',
    'parallel_tool_calls',
  ]) {
    if (body[key] !== undefined) chatBody[key] = body[key];
  }

  if (body.max_output_tokens !== undefined) chatBody.max_tokens = body.max_output_tokens;
  if (Array.isArray(body.tools)) chatBody.tools = toChatTools(body.tools);
  if (body.tool_choice !== undefined) chatBody.tool_choice = toChatToolChoice(body.tool_choice);

  return chatBody;
}

function toChatTools(tools: unknown[]): JsonRecord[] {
  return tools.filter(isRecord).map((tool) => {
    if (tool.type !== 'function') return tool;
    return {
      type: 'function',
      function: {
        name: tool.name,
        ...(tool.description !== undefined && { description: tool.description }),
        ...(tool.parameters !== undefined && { parameters: tool.parameters }),
        ...(tool.strict !== undefined && { strict: tool.strict }),
      },
    };
  });
}

function toChatToolChoice(toolChoice: unknown): unknown {
  if (!isRecord(toolChoice) || toolChoice.type !== 'function') return toolChoice;
  return { type: 'function', function: { name: toolChoice.name } };
}

export function toNativeResponsesRequest(
  body: JsonRecord,
  model: string,
  opts?: { defaultInstructions?: boolean; inputList?: boolean; forceStream?: boolean },
): JsonRecord {
  const request: JsonRecord = { ...body, model };
  if (opts?.forceStream) {
    request.stream = true;
  } else if (body.stream === undefined) {
    request.stream = false;
  }
  if (body.store === undefined) request.store = false;
  if (opts?.inputList) {
    request.input = toNativeResponsesInput(body.input);
  }
  if (
    opts?.defaultInstructions &&
    (typeof request.instructions !== 'string' || !request.instructions.trim())
  ) {
    request.instructions = DEFAULT_INSTRUCTIONS;
  }
  return request;
}

function toNativeResponsesInput(input: unknown): unknown {
  if (typeof input === 'string') {
    return [{ role: 'user', content: [{ type: 'input_text', text: input }] }];
  }
  if (!Array.isArray(input)) return input;

  return input.flatMap((item) => {
    if (typeof item === 'string') {
      return [{ role: 'user', content: [{ type: 'input_text', text: item }] }];
    }
    if (!isRecord(item) || item.type === 'function_call' || item.type === 'function_call_output') {
      return isRecord(item) ? [item] : [];
    }

    const role = typeof item.role === 'string' ? item.role : 'user';
    return [{ ...item, role, content: toNativeResponsesContent(item.content, role) }];
  });
}

function toNativeResponsesContent(content: unknown, role: string): unknown {
  const partType = role === 'assistant' ? 'output_text' : 'input_text';

  if (typeof content === 'string') return [{ type: partType, text: content }];
  if (!Array.isArray(content)) return content;

  return content.filter(isRecord).map((part) => {
    if (typeof part.text === 'string' && (part.type === 'text' || part.type === undefined)) {
      return { ...part, type: partType };
    }
    return part;
  });
}

export function fromChatCompletionResponse(body: JsonRecord, model: string): JsonRecord {
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const firstChoice = isRecord(choices[0]) ? choices[0] : {};
  const message = isRecord(firstChoice.message) ? firstChoice.message : {};
  const output: JsonRecord[] = [];
  const contentText = textFromContent(message.content);

  if (contentText) {
    output.push({
      type: 'message',
      id: `msg_${randomUUID().replace(/-/g, '')}`,
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: contentText, annotations: [] }],
    });
  }

  if (Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      if (!isRecord(toolCall) || !isRecord(toolCall.function)) continue;
      output.push({
        type: 'function_call',
        id: `fc_${randomUUID().replace(/-/g, '')}`,
        call_id: typeof toolCall.id === 'string' ? toolCall.id : randomUUID(),
        name: typeof toolCall.function.name === 'string' ? toolCall.function.name : '',
        arguments:
          typeof toolCall.function.arguments === 'string' ? toolCall.function.arguments : '{}',
        status: 'completed',
      });
    }
  }

  const created = typeof body.created === 'number' ? body.created : Math.floor(Date.now() / 1000);
  return {
    id: `resp_${randomUUID().replace(/-/g, '')}`,
    object: 'response',
    created_at: created,
    status: 'completed',
    completed_at: created,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: typeof body.model === 'string' ? body.model : model,
    output,
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: { effort: null, summary: null },
    store: false,
    temperature: null,
    text: { format: { type: 'text' } },
    tool_choice: 'auto',
    tools: [],
    top_p: null,
    truncation: 'disabled',
    usage: toResponsesUsage(body.usage),
    user: null,
    metadata: {},
  };
}

function toResponsesUsage(usage: unknown): JsonRecord | null {
  if (!isRecord(usage)) return null;
  const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
  const completionTokens =
    typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
  const totalTokens =
    typeof usage.total_tokens === 'number' ? usage.total_tokens : promptTokens + completionTokens;
  const cachedTokens =
    typeof usage.cache_read_tokens === 'number' ? usage.cache_read_tokens : undefined;

  return {
    input_tokens: promptTokens,
    input_tokens_details: { cached_tokens: cachedTokens ?? 0 },
    output_tokens: completionTokens,
    output_tokens_details: { reasoning_tokens: 0 },
    total_tokens: totalTokens,
  };
}

export function collectResponsesSseResponse(sseText: string): JsonRecord {
  let text = '';
  let completed: JsonRecord | null = null;

  for (const event of sseText.split('\n\n')) {
    const parsed = parseSseEvent(event);
    if (!parsed) continue;
    if (parsed.event === 'response.output_text.delta') {
      const data = safeParse(parsed.data);
      if (typeof data?.delta === 'string') text += data.delta;
    }
    if (parsed.event === 'response.completed') {
      const data = safeParse(parsed.data);
      completed = isRecord(data?.response) ? data.response : null;
    }
  }

  if (completed) return withCollectedTextOutput(completed, text);
  return fromChatCompletionResponse(
    {
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    },
    'unknown',
  );
}

function withCollectedTextOutput(response: JsonRecord, text: string): JsonRecord {
  if (!text) return response;
  const output = Array.isArray(response.output) ? response.output : [];
  const hasTextOutput = output.some((item) => {
    if (!isRecord(item) || !Array.isArray(item.content)) return false;
    return item.content.some(
      (part) => isRecord(part) && part.type === 'output_text' && typeof part.text === 'string',
    );
  });
  if (hasTextOutput) return response;

  return {
    ...response,
    output: [
      ...output,
      {
        type: 'message',
        id: `msg_${randomUUID().replace(/-/g, '')}`,
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    ],
  };
}

function parseSseEvent(raw: string): { event: string; data: string } | null {
  let event = '';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    if (line.startsWith('data: ')) data += line.slice(6);
  }
  return event || data ? { event, data } : null;
}

function safeParse(data: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(data);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function chatCompletionStreamChunkToResponses(chunk: string): string | null {
  const payloads = extractDataPayloads(chunk);
  const events: string[] = [];

  for (const payload of payloads) {
    if (payload === '[DONE]') continue;
    const data = safeParse(payload);
    if (!data) continue;
    const choices = Array.isArray(data.choices) ? data.choices : [];
    if (choices.length === 0 && isRecord(data.usage)) {
      events.push(
        formatResponsesEvent('response.completed', {
          type: 'response.completed',
          response: fromChatCompletionResponse(
            {
              model: typeof data.model === 'string' ? data.model : undefined,
              usage: data.usage,
              choices: [{ message: { content: '' } }],
            },
            typeof data.model === 'string' ? data.model : 'unknown',
          ),
        }),
      );
      continue;
    }

    const choice = isRecord(choices[0]) ? choices[0] : null;
    const delta = isRecord(choice?.delta) ? choice.delta : {};

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      events.push(
        formatResponsesEvent('response.output_text.delta', {
          type: 'response.output_text.delta',
          item_id: 'msg_0',
          output_index: 0,
          content_index: 0,
          delta: delta.content,
        }),
      );
    }

    if (choice?.finish_reason) {
      events.push(
        formatResponsesEvent('response.completed', {
          type: 'response.completed',
          response: fromChatCompletionResponse(
            {
              model: typeof data.model === 'string' ? data.model : undefined,
              usage: data.usage,
              choices: [{ message: { content: '' } }],
            },
            typeof data.model === 'string' ? data.model : 'unknown',
          ),
        }),
      );
    }
  }

  return events.length > 0 ? events.join('') : null;
}

function extractDataPayloads(chunk: string): string[] {
  const lines = chunk.split('\n').map((line) => line.trim());
  const dataLines = lines.filter((line) => line.startsWith('data:'));
  if (dataLines.length > 0) return dataLines.map((line) => line.slice(5).trim());
  return [chunk.trim()].filter(Boolean);
}

function formatResponsesEvent(event: string, data: JsonRecord): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
