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

export class ResponsesSseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ResponsesSseError';
  }
}

/* ── Request conversion ── */

export interface ToResponsesRequestOptions {
  /**
   * Map `max_tokens` / `max_completion_tokens` → `max_output_tokens`.
   * The ChatGPT subscription backend (`chatgpt.com/backend-api/codex/responses`)
   * rejects `max_output_tokens`, so callers that target that endpoint must
   * leave this disabled. API-key /responses and Copilot /responses accept it.
   */
  mapMaxOutputTokens?: boolean;
  /**
   * Forward the caller's `prompt_cache_key` so same-prefix requests keep
   * their prompt-cache affinity. Opt-in per endpoint: OpenAI's /responses
   * endpoints accept the field, other Responses-shaped backends may reject
   * unknown parameters.
   */
  forwardPromptCacheKey?: boolean;
  /**
   * Explicit upstream streaming mode. Omit to preserve the historical
   * ChatGPT-subscription behavior, which expects SSE collection.
   */
  stream?: boolean;
}

export function toResponsesRequest(
  body: Record<string, unknown>,
  model: string,
  options: ToResponsesRequestOptions = {},
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
    stream: options.stream ?? body.stream !== false,
    store: false,
    instructions: extractInstructions(messages),
  };

  // Map Chat Completions token caps to the Responses API field so callers
  // don't silently lose their output limit when routed to /responses.
  // Gated because the ChatGPT subscription backend rejects max_output_tokens.
  if (options.mapMaxOutputTokens) {
    const maxOutputTokens = body.max_completion_tokens ?? body.max_tokens;
    if (typeof maxOutputTokens === 'number') {
      request.max_output_tokens = maxOutputTokens;
    }
  }

  if (
    options.forwardPromptCacheKey &&
    typeof body.prompt_cache_key === 'string' &&
    body.prompt_cache_key
  ) {
    request.prompt_cache_key = body.prompt_cache_key;
  }

  if (isObjectRecord(body.reasoning)) {
    request.reasoning = body.reasoning;
  }

  if (isObjectRecord(body.text)) {
    request.text = body.text;
  }

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

interface ResponsesStreamEvent {
  eventType: string;
  dataStr: string;
}

interface ToolCallState {
  id: string;
  name: string;
  arguments: string;
  finalArguments?: string;
  metadataEmitted: boolean;
}

export interface ChatGptStreamTransformer {
  transform: (chunk: string) => string | null;
  finalize: () => string | null;
}

function parseResponsesStreamEvent(chunk: string): ResponsesStreamEvent | null {
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
  return { eventType, dataStr };
}

function responseOutputIndex(data: Record<string, unknown>, fallback: number): number {
  return typeof data.output_index === 'number' ? data.output_index : fallback;
}

function itemId(item: Record<string, unknown> | undefined): string | undefined {
  if (!item) return undefined;
  if (typeof item.id === 'string' && item.id) return item.id;
  return undefined;
}

function itemCallId(item: Record<string, unknown> | undefined): string | undefined {
  if (!item) return undefined;
  if (typeof item.call_id === 'string' && item.call_id) return item.call_id;
  return undefined;
}

function itemName(item: Record<string, unknown> | undefined): string | undefined {
  return typeof item?.name === 'string' ? item.name : undefined;
}

function itemArguments(item: Record<string, unknown> | undefined): string | undefined {
  return typeof item?.arguments === 'string' ? item.arguments : undefined;
}

function isFunctionCallItem(item: Record<string, unknown> | undefined): boolean {
  return item?.type === 'function_call';
}

function missingArgumentDelta(current: string, finalArguments: string): string {
  if (!finalArguments) return '';
  if (!current) return finalArguments;
  if (finalArguments === current) return '';
  if (finalArguments.startsWith(current)) return finalArguments.slice(current.length);
  return '';
}

function formatToolCallMetadata(index: number, state: ToolCallState, model: string): string {
  return formatSSE(
    {
      delta: {
        tool_calls: [
          {
            index,
            id: state.id,
            type: 'function',
            function: { name: state.name, arguments: '' },
          },
        ],
      },
      finish_reason: null,
    },
    model,
  );
}

function formatToolCallArguments(index: number, delta: string, model: string): string {
  return formatSSE(
    {
      delta: {
        tool_calls: [
          {
            index,
            function: { arguments: delta },
          },
        ],
      },
      finish_reason: null,
    },
    model,
  );
}

/**
 * Transform a single Responses API SSE chunk into an OpenAI
 * Chat Completions SSE chunk. Returns null for irrelevant events.
 */
export function transformResponsesStreamChunk(chunk: string, model: string): string | null {
  const parsedEvent = parseResponsesStreamEvent(chunk);
  if (!parsedEvent) return null;
  const { eventType, dataStr } = parsedEvent;

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

  if (eventType === 'response.incomplete') {
    return handleIncompleteEvent(dataStr, model);
  }

  if (eventType === 'error' || eventType === 'response.failed') {
    return handleStreamErrorEvent(dataStr);
  }

  return null;
}

export function createChatGptStreamTransformer(model: string): ChatGptStreamTransformer {
  const toolCalls = new Map<number, ToolCallState>();
  const itemIndex = new Map<string, number>();
  const callIndex = new Map<string, number>();
  let terminalSeen = false;

  const rememberItem = (idx: number, item: Record<string, unknown> | undefined): void => {
    const id = itemId(item);
    const callId = itemCallId(item);
    if (id) itemIndex.set(id, idx);
    if (callId) callIndex.set(callId, idx);
  };

  const resolveIndex = (
    data: Record<string, unknown>,
    item: Record<string, unknown> | undefined,
    fallback: number,
  ): number => {
    if (typeof data.output_index === 'number') return data.output_index;
    const id = itemId(item);
    if (id && itemIndex.has(id)) return itemIndex.get(id)!;
    const callId = itemCallId(item);
    if (callId && callIndex.has(callId)) return callIndex.get(callId)!;
    return fallback;
  };

  const upsertToolCall = (
    idx: number,
    item: Record<string, unknown> | undefined,
  ): ToolCallState => {
    let state = toolCalls.get(idx);
    if (!state) {
      state = {
        id: '',
        name: '',
        arguments: '',
        metadataEmitted: false,
      };
      toolCalls.set(idx, state);
    }

    const callId = itemCallId(item);
    const name = itemName(item);
    if (callId) state.id = callId;
    if (name !== undefined) state.name = name;
    rememberItem(idx, item);
    return state;
  };

  const emitMetadataIfNeeded = (idx: number, state: ToolCallState): string => {
    if (state.metadataEmitted) return '';
    state.metadataEmitted = true;
    return formatToolCallMetadata(idx, state, model);
  };

  const emitFinalArguments = (
    idx: number,
    state: ToolCallState,
    finalArguments: string,
  ): string => {
    state.finalArguments = finalArguments;
    const delta = missingArgumentDelta(state.arguments, finalArguments);
    if (!delta) {
      if (finalArguments === state.arguments) state.arguments = finalArguments;
      return '';
    }
    state.arguments += delta;
    return formatToolCallArguments(idx, delta, model);
  };

  const emitFunctionCallItem = (idx: number, item: Record<string, unknown> | undefined): string => {
    const state = upsertToolCall(idx, item);
    const chunks = [emitMetadataIfNeeded(idx, state)];
    const finalArguments = itemArguments(item);
    if (finalArguments !== undefined) {
      chunks.push(emitFinalArguments(idx, state, finalArguments));
    }
    return chunks.join('');
  };

  const flushCompletedOutput = (response: Record<string, unknown> | undefined): string => {
    const output = Array.isArray(response?.output)
      ? (response.output as Array<Record<string, unknown>>)
      : [];
    const chunks: string[] = [];
    output.forEach((item, outputIndex) => {
      if (!isFunctionCallItem(item)) return;
      const idx = responseOutputIndex(item, outputIndex);
      const emitted = emitFunctionCallItem(idx, item);
      if (emitted) chunks.push(emitted);
    });
    for (const [idx, state] of toolCalls) {
      if (!state.finalArguments) continue;
      const metadata = emitMetadataIfNeeded(idx, state);
      const args = emitFinalArguments(idx, state, state.finalArguments);
      if (metadata) chunks.push(metadata);
      if (args) chunks.push(args);
    }
    return chunks.join('');
  };

  return {
    transform(chunk: string): string | null {
      const parsedEvent = parseResponsesStreamEvent(chunk);
      if (!parsedEvent) return null;
      const { eventType, dataStr } = parsedEvent;

      if (eventType === 'response.output_item.added') {
        const data = safeParse(dataStr);
        if (!data) return null;
        const item = isObjectRecord(data.item) ? data.item : undefined;
        if (!isFunctionCallItem(item)) return null;
        const idx = resolveIndex(data, item, toolCalls.size);
        return emitFunctionCallItem(idx, item) || null;
      }

      if (eventType === 'response.function_call_arguments.delta') {
        const data = safeParse(dataStr);
        if (!data) return null;
        const idx = responseOutputIndex(data, 0);
        const state = upsertToolCall(idx, undefined);
        const delta = typeof data.delta === 'string' ? data.delta : '';
        state.arguments += delta;
        return formatToolCallArguments(idx, delta, model);
      }

      if (eventType === 'response.function_call_arguments.done') {
        const data = safeParse(dataStr);
        if (!data) return null;
        const idx = responseOutputIndex(data, 0);
        const state = upsertToolCall(idx, undefined);
        const finalArguments = typeof data.arguments === 'string' ? data.arguments : undefined;
        if (finalArguments === undefined) return null;
        state.finalArguments = finalArguments;
        if (!state.metadataEmitted) return null;
        return emitFinalArguments(idx, state, finalArguments) || null;
      }

      if (eventType === 'response.output_item.done') {
        const data = safeParse(dataStr);
        if (!data) return null;
        const item = isObjectRecord(data.item) ? data.item : undefined;
        if (!isFunctionCallItem(item)) return null;
        const idx = resolveIndex(data, item, toolCalls.size);
        const emitted = emitFunctionCallItem(idx, item);
        return emitted || null;
      }

      if (eventType === 'response.completed') {
        terminalSeen = true;
        const data = safeParse(dataStr);
        const response = isObjectRecord(data?.response) ? data.response : undefined;
        return `${flushCompletedOutput(response)}${handleCompletedEvent(dataStr, model)}`;
      }

      if (eventType === 'response.incomplete') {
        terminalSeen = true;
        return handleIncompleteEvent(dataStr, model);
      }

      if (eventType === 'error' || eventType === 'response.failed') {
        terminalSeen = true;
        return handleStreamErrorEvent(dataStr);
      }

      return transformResponsesStreamChunk(chunk, model);
    },

    finalize(): string | null {
      return terminalSeen ? null : 'data: [DONE]\n\n';
    },
  };
}

function handleCompletedEvent(dataStr: string, model: string): string {
  const data = safeParse(dataStr);
  const response = isObjectRecord(data?.response) ? data.response : undefined;
  const responseOutput = Array.isArray(response?.output)
    ? (response.output as Array<{ type?: string }>)
    : [];
  const hasFunctionCalls = responseOutput.some((item) => item.type === 'function_call');
  const finish = formatSSE(
    { delta: {}, finish_reason: hasFunctionCalls ? 'tool_calls' : 'stop' },
    model,
    extractResponseUsage(response),
  );
  return `${finish}\ndata: [DONE]\n\n`;
}

/**
 * `response.incomplete` is the Responses API's third terminal event (after
 * `response.completed` and `response.failed`) — emitted when generation stops
 * early on `max_output_tokens` or a content filter. Without handling it the
 * stream ends with no finish chunk and clients report an interrupted stream
 * (issue #2212's symptom).
 */
function handleIncompleteEvent(dataStr: string, model: string): string {
  const data = safeParse(dataStr);
  const response = isObjectRecord(data?.response) ? data.response : undefined;
  const finish = formatSSE(
    { delta: {}, finish_reason: incompleteFinishReason(response) },
    model,
    extractResponseUsage(response),
  );
  return `${finish}\ndata: [DONE]\n\n`;
}

function incompleteFinishReason(response: Record<string, unknown> | undefined): string {
  const details = isObjectRecord(response?.incomplete_details)
    ? response.incomplete_details
    : undefined;
  return details?.reason === 'content_filter' ? 'content_filter' : 'length';
}

function extractResponseUsage(
  response: Record<string, unknown> | undefined,
): Record<string, number> | undefined {
  const responseUsage = response?.usage as Record<string, unknown> | undefined;
  if (!responseUsage) return undefined;
  const inputDetails = responseUsage.input_tokens_details as Record<string, number> | undefined;
  return {
    prompt_tokens: (responseUsage.input_tokens as number) ?? 0,
    completion_tokens: (responseUsage.output_tokens as number) ?? 0,
    total_tokens: (responseUsage.total_tokens as number) ?? 0,
    cache_read_tokens: inputDetails?.cached_tokens ?? 0,
    cache_creation_tokens: 0,
  };
}

function handleStreamErrorEvent(dataStr: string): string {
  const data = safeParse(dataStr) ?? {};
  const err = buildResponsesSseError(data);
  const parsedBody = safeParse(err.body);
  const parsedError = isObjectRecord(parsedBody?.error) ? parsedBody.error : {};
  const message =
    typeof parsedError.message === 'string' && parsedError.message
      ? parsedError.message
      : err.message;
  const code = typeof parsedError.code === 'string' ? parsedError.code : undefined;
  const type = typeof parsedError.type === 'string' ? parsedError.type : 'upstream_error';
  const payload = {
    error: {
      message,
      type,
      status: err.status,
      ...(code ? { code } : {}),
    },
  };
  return `data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`;
}

/* ── Non-streaming SSE collection ── */

/**
 * The Codex Responses API always returns SSE even when `stream: false`.
 * This function consumes the SSE text and builds a non-streaming
 * OpenAI Chat Completion response from the collected events.
 */
export function collectChatGptSseResponse(sseText: string, model: string): Record<string, unknown> {
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
  let finishReasonOverride: string | undefined;

  const upsertToolCall = (
    idx: number,
    item: Record<string, unknown> | undefined,
  ): { id: string; type: string; function: { name: string; arguments: string } } => {
    let toolCall = toolCallMap.get(idx);
    if (!toolCall) {
      toolCall = {
        id: '',
        type: 'function',
        function: { name: '', arguments: '' },
      };
      toolCallMap.set(idx, toolCall);
    }

    const callId = itemCallId(item);
    const name = itemName(item);
    const args = itemArguments(item);
    if (callId) toolCall.id = callId;
    if (name !== undefined) toolCall.function.name = name;
    if (args !== undefined) toolCall.function.arguments = args;
    return toolCall;
  };

  const collectResponseOutput = (response: Record<string, unknown> | undefined): void => {
    const output = Array.isArray(response?.output)
      ? (response.output as Array<Record<string, unknown>>)
      : [];
    hasFunctionCalls = output.some((item) => item.type === 'function_call');
    output.forEach((item, outputIndex) => {
      if (!isFunctionCallItem(item)) return;
      upsertToolCall(responseOutputIndex(item, outputIndex), item);
    });
  };

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

    if (eventType === 'error' || eventType === 'response.failed') {
      throw buildResponsesSseError(data);
    } else if (eventType === 'response.output_text.delta') {
      text += typeof data.delta === 'string' ? data.delta : '';
    } else if (eventType === 'response.output_item.added') {
      const item = isObjectRecord(data.item) ? data.item : undefined;
      if (item?.type === 'function_call') {
        const idx = typeof data.output_index === 'number' ? data.output_index : toolCallMap.size;
        upsertToolCall(idx, item);
      }
    } else if (eventType === 'response.function_call_arguments.delta') {
      const idx = typeof data.output_index === 'number' ? data.output_index : 0;
      const tc = toolCallMap.get(idx);
      if (tc) {
        tc.function.arguments += typeof data.delta === 'string' ? data.delta : '';
      }
    } else if (eventType === 'response.function_call_arguments.done') {
      const idx = typeof data.output_index === 'number' ? data.output_index : 0;
      const tc = upsertToolCall(idx, undefined);
      if (typeof data.arguments === 'string') tc.function.arguments = data.arguments;
    } else if (eventType === 'response.output_item.done') {
      const item = isObjectRecord(data.item) ? data.item : undefined;
      if (isFunctionCallItem(item)) {
        const idx = resolveResponseItemIndex(data, item, toolCallMap);
        upsertToolCall(idx, item);
      }
    } else if (eventType === 'response.completed') {
      const response = isObjectRecord(data.response) ? data.response : undefined;
      usage = extractResponseUsage(response) ?? usage;
      collectResponseOutput(response);
    } else if (eventType === 'response.incomplete') {
      const response = isObjectRecord(data.response) ? data.response : undefined;
      usage = extractResponseUsage(response) ?? usage;
      finishReasonOverride = incompleteFinishReason(response);
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
        finish_reason:
          finishReasonOverride ??
          (hasFunctionCalls || toolCalls.length > 0 ? 'tool_calls' : 'stop'),
      },
    ],
    usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function resolveResponseItemIndex(
  data: Record<string, unknown>,
  item: Record<string, unknown> | undefined,
  toolCallMap: Map<
    number,
    { id: string; type: string; function: { name: string; arguments: string } }
  >,
): number {
  if (typeof data.output_index === 'number') return data.output_index;
  const callId = itemCallId(item);
  if (callId) {
    for (const [idx, toolCall] of toolCallMap) {
      if (toolCall.id === callId) return idx;
    }
  }
  return toolCallMap.size;
}

function buildResponsesSseError(data: Record<string, unknown>): ResponsesSseError {
  const response = isObjectRecord(data.response) ? data.response : undefined;
  const error = isObjectRecord(data.error)
    ? data.error
    : isObjectRecord(response?.error)
      ? response.error
      : data;
  const message =
    typeof error.message === 'string' && error.message
      ? error.message
      : 'OpenAI Responses stream failed';
  const code = typeof error.code === 'string' ? error.code : undefined;
  const type = typeof error.type === 'string' ? error.type : undefined;
  const status = statusFromResponsesError(code, type);
  const body = JSON.stringify({
    error: {
      message,
      ...(code ? { code } : {}),
      ...(type ? { type } : {}),
    },
  });
  return new ResponsesSseError(message, status, body);
}

function statusFromResponsesError(code: string | undefined, type: string | undefined): number {
  const value = (code ?? type ?? '').toLowerCase();
  if (value.includes('model_not_found') || value.includes('not_found')) return 404;
  if (value.includes('rate_limit')) return 429;
  if (value.includes('invalid') || value.includes('bad_request')) return 400;
  if (value.includes('unauthorized') || value.includes('authentication')) return 401;
  if (value.includes('forbidden') || value.includes('permission')) return 403;
  if (value.includes('server')) return 500;
  return 502;
}
