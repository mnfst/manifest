/**
 * Converts between OpenAI Chat Completions format and the
 * ChatGPT Codex Responses API format used by subscription tokens.
 *
 * Endpoint: POST https://chatgpt.com/backend-api/codex/responses
 */

import { randomUUID } from 'crypto';

import {
  convertAssistantToolCalls,
  convertContent,
  convertTools,
  extractInstructions,
  extractTextContent,
  formatSSE,
  isObjectRecord,
  safeParse,
} from './chatgpt-helpers';
import { OpenAIMessage } from './proxy-types';

/* ── Request conversion ── */

export function toResponsesRequest(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const messages = (body.messages ?? []) as OpenAIMessage[];
  const input: Record<string, unknown>[] = [];

  for (const message of messages) {
    if (message.role === 'system' || message.role === 'developer') continue;

    if (
      message.role === 'assistant' &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0
    ) {
      const assistantText = extractTextContent(message.content);
      if (assistantText) {
        input.push({ role: 'assistant', content: convertContent(assistantText, 'assistant') });
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

    input.push({ role: message.role, content: convertContent(message.content, message.role) });
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
  const lines = chunk.split('\n');
  let eventType = '';
  let dataStr = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      dataStr = line.slice(6);
    } else if (line.trim()) {
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
    return handleCompletedEvent(dataStr, model);
  }

  return null;
}

function handleCompletedEvent(dataStr: string, model: string): string {
  const data = safeParse(dataStr);
  const response = isObjectRecord(data?.response) ? data.response : undefined;
  const responseUsage = response?.usage as Record<string, unknown> | undefined;
  const inputDetails = responseUsage?.input_tokens_details as Record<string, number> | undefined;
  const cachedTokens = inputDetails?.cached_tokens ?? 0;

  const usage = responseUsage
    ? {
        prompt_tokens: (responseUsage.input_tokens as number) ?? 0,
        completion_tokens: (responseUsage.output_tokens as number) ?? 0,
        total_tokens: (responseUsage.total_tokens as number) ?? 0,
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

/* ── Non-streaming SSE collection ── */

/**
 * The Codex Responses API always returns SSE even when `stream: false`.
 * This function consumes the SSE text and builds a non-streaming
 * OpenAI Chat Completion response from the collected events.
 */
export function collectChatGptSseResponse(
  sseText: string,
  model: string,
): Record<string, unknown> {
  let text = '';
  // Map output_index → tool call to handle mixed output items correctly.
  // The output_index from the API refers to position in the full output array
  // (which can include non-function items like messages), so we cannot use a
  // plain array indexed by push order.
  const toolCallMap = new Map<
    number,
    { id: string; type: string; function: { name: string; arguments: string } }
  >();
  let usage: Record<string, unknown> | undefined;
  let hasFunctionCalls = false;

  const events = sseText.split('\n\n');
  for (const event of events) {
    const lines = event.split('\n');
    let eventType = '';
    let dataStr = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) eventType = line.slice(7).trim();
      else if (line.startsWith('data: ')) dataStr = line.slice(6);
    }
    if (!eventType || !dataStr) continue;

    const data = safeParse(dataStr);
    if (!data) continue;

    if (eventType === 'response.output_text.delta') {
      text += typeof data.delta === 'string' ? data.delta : '';
    } else if (eventType === 'response.output_item.added') {
      const item = isObjectRecord(data.item) ? data.item : undefined;
      if (item?.type === 'function_call') {
        const idx = typeof data.output_index === 'number' ? data.output_index : toolCallMap.size;
        toolCallMap.set(idx, {
          id: (item.call_id as string) ?? '',
          type: 'function',
          function: { name: (item.name as string) ?? '', arguments: '' },
        });
      }
    } else if (eventType === 'response.function_call_arguments.delta') {
      const idx = typeof data.output_index === 'number' ? data.output_index : 0;
      const tc = toolCallMap.get(idx);
      if (tc) {
        tc.function.arguments += typeof data.delta === 'string' ? data.delta : '';
      }
    } else if (eventType === 'response.completed') {
      const response = isObjectRecord(data.response) ? data.response : undefined;
      const respUsage = response?.usage as Record<string, unknown> | undefined;
      if (respUsage) {
        const inputDetails = respUsage.input_tokens_details as Record<string, number> | undefined;
        usage = {
          prompt_tokens: (respUsage.input_tokens as number) ?? 0,
          completion_tokens: (respUsage.output_tokens as number) ?? 0,
          total_tokens: (respUsage.total_tokens as number) ?? 0,
          cache_read_tokens: inputDetails?.cached_tokens ?? 0,
          cache_creation_tokens: 0,
        };
      }
      const output = Array.isArray(response?.output)
        ? (response.output as Array<{ type?: string }>)
        : [];
      hasFunctionCalls = output.some((item) => item.type === 'function_call');
    }
  }

  const toolCalls = [...toolCallMap.values()];
  const message: Record<string, unknown> = { role: 'assistant', content: text || null };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  return {
    id: `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 29)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: hasFunctionCalls || toolCalls.length > 0 ? 'tool_calls' : 'stop',
      },
    ],
    usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
