import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';

export const KIRO_BASE_URL = 'https://q.us-east-1.amazonaws.com';
export const KIRO_MODELS_TARGET = 'AmazonCodeWhispererService.ListAvailableModels';
export const KIRO_CHAT_TARGET = 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse';

const KIRO_ORIGIN = 'KIRO_CLI';
const KIRO_AGENT_MODE = 'SUPERVISED';
const DEFAULT_KIRO_CONTEXT_WINDOW = 200000;
const AUTO_KIRO_CONTEXT_WINDOW = 1000000;

export function buildKiroHeaders(apiKey: string, target: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/x-amz-json-1.0',
    'x-amz-target': target,
  };
}

export function toKiroModelId(model: string): string {
  return model.replace(/^kiro\//i, '');
}

function formatKiroModelId(modelId: string): string {
  return modelId.toLowerCase().startsWith('kiro/') ? modelId : `kiro/${modelId}`;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readKiroContextWindow(entry: Record<string, unknown>, modelId: string): number {
  const tokenLimits = (entry.tokenLimits ?? entry.token_limits) as
    | Record<string, unknown>
    | undefined;
  return (
    readNumber(entry.contextWindowTokens) ??
    readNumber(entry.context_window_tokens) ??
    readNumber(tokenLimits?.contextWindowTokens) ??
    readNumber(tokenLimits?.context_window_tokens) ??
    readNumber(tokenLimits?.maxInputTokens) ??
    readNumber(tokenLimits?.max_input_tokens) ??
    (modelId === 'auto' ? AUTO_KIRO_CONTEXT_WINDOW : DEFAULT_KIRO_CONTEXT_WINDOW)
  );
}

export function parseKiroModels(body: unknown, provider = 'kiro'): DiscoveredModel[] {
  const models = (body as { models?: unknown[] })?.models;
  if (!Array.isArray(models)) return [];

  return models
    .map((raw) => raw as Record<string, unknown>)
    .filter((entry) => typeof (entry.modelId ?? entry.model_id) === 'string')
    .map((entry) => {
      const rawId = String(entry.modelId ?? entry.model_id);
      const id = formatKiroModelId(rawId);
      const displayName = String(entry.modelName ?? entry.model_name ?? rawId);
      return {
        id,
        displayName,
        provider,
        contextWindow: readKiroContextWindow(entry, rawId),
        inputPricePerToken: 0,
        outputPricePerToken: 0,
        capabilityReasoning: false,
        capabilityCode: true,
        qualityScore: 3,
      };
    });
}

type OpenAiMessage = {
  role?: string;
  content?: unknown;
  tool_call_id?: string;
};

type KiroMessage =
  | {
      userInputMessage: {
        content: string;
        origin: string;
        modelId?: string;
      };
    }
  | {
      assistantResponseMessage: {
        content: string;
      };
    };

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        const record = part as Record<string, unknown>;
        if (typeof record.text === 'string') return record.text;
        if (record.type === 'image_url' || record.type === 'input_image') return '[image omitted]';
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function toUserMessage(content: string, modelId?: string): KiroMessage {
  return {
    userInputMessage: {
      content,
      origin: KIRO_ORIGIN,
      ...(modelId ? { modelId } : {}),
    },
  };
}

function toAssistantMessage(content: string): KiroMessage {
  return {
    assistantResponseMessage: {
      content,
    },
  };
}

export function buildKiroChatRequest(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const messages = Array.isArray(body.messages) ? (body.messages as OpenAiMessage[]) : [];
  const systemText = messages
    .filter((message) => message.role === 'system' || message.role === 'developer')
    .map((message) => stringifyContent(message.content))
    .filter(Boolean)
    .join('\n\n');

  const lastUserIndex = messages.reduce(
    (last, message, index) => (message.role === 'user' ? index : last),
    -1,
  );
  const currentIndex = lastUserIndex >= 0 ? lastUserIndex : messages.length - 1;
  const history: KiroMessage[] = [];

  for (let index = 0; index < currentIndex; index += 1) {
    const message = messages[index];
    if (message.role === 'system' || message.role === 'developer') continue;
    const content = stringifyContent(message.content);
    if (!content) continue;
    if (message.role === 'assistant') {
      history.push(toAssistantMessage(content));
    } else if (message.role === 'tool') {
      history.push(
        toUserMessage(
          `Tool result${message.tool_call_id ? ` ${message.tool_call_id}` : ''}:\n${content}`,
        ),
      );
    } else {
      history.push(toUserMessage(content));
    }
  }

  const currentMessage = currentIndex >= 0 ? messages[currentIndex] : undefined;
  const currentText = currentMessage ? stringifyContent(currentMessage.content) : '';
  const content = systemText
    ? `System instructions:\n${systemText}\n\nUser:\n${currentText}`
    : currentText;

  return {
    conversationState: {
      conversationId: randomUUID(),
      history,
      currentMessage: toUserMessage(content || 'Hello', model),
      chatTriggerType: 'MANUAL',
    },
    agentMode: KIRO_AGENT_MODE,
  };
}

export interface KiroEvent {
  eventType?: string;
  messageType?: string;
  payload: unknown;
}

function parseEventHeaders(buffer: Buffer): Record<string, unknown> {
  const headers: Record<string, unknown> = {};
  let offset = 0;

  while (offset < buffer.length) {
    const nameLength = buffer.readUInt8(offset);
    offset += 1;
    const name = buffer.toString('utf8', offset, offset + nameLength);
    offset += nameLength;
    const type = buffer.readUInt8(offset);
    offset += 1;

    if (type === 0 || type === 1) {
      headers[name] = type === 0;
    } else if (type === 2) {
      headers[name] = buffer.readInt8(offset);
      offset += 1;
    } else if (type === 3) {
      headers[name] = buffer.readInt16BE(offset);
      offset += 2;
    } else if (type === 4) {
      headers[name] = buffer.readInt32BE(offset);
      offset += 4;
    } else if (type === 5) {
      headers[name] = buffer.readBigInt64BE(offset);
      offset += 8;
    } else if (type === 6) {
      const valueLength = buffer.readUInt16BE(offset);
      offset += 2;
      headers[name] = Buffer.from(buffer.subarray(offset, offset + valueLength));
      offset += valueLength;
    } else if (type === 7) {
      const valueLength = buffer.readUInt16BE(offset);
      offset += 2;
      headers[name] = buffer.toString('utf8', offset, offset + valueLength);
      offset += valueLength;
    } else if (type === 8) {
      headers[name] = new Date(Number(buffer.readBigInt64BE(offset)));
      offset += 8;
    } else if (type === 9) {
      const value = buffer.subarray(offset, offset + 16).toString('hex');
      headers[name] = `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(
        12,
        16,
      )}-${value.slice(16, 20)}-${value.slice(20)}`;
      offset += 16;
    } else {
      // Future header value types have type-specific lengths. Keep the payload
      // usable instead of guessing how many bytes to skip and corrupting the
      // remaining header parse.
      break;
    }
  }

  return headers;
}

export class KiroEventStreamParser {
  private pending = Buffer.alloc(0);

  push(chunk: Uint8Array): KiroEvent[] {
    this.pending = Buffer.concat([this.pending, Buffer.from(chunk)]);
    const events: KiroEvent[] = [];

    while (this.pending.length >= 12) {
      const totalLength = this.pending.readUInt32BE(0);
      const headersLength = this.pending.readUInt32BE(4);
      if (totalLength < 16 || headersLength > totalLength - 16) {
        throw new Error('Invalid Kiro event stream frame');
      }
      if (this.pending.length < totalLength) break;

      const frame = this.pending.subarray(0, totalLength);
      this.pending = this.pending.subarray(totalLength);
      const headersStart = 12;
      const payloadStart = headersStart + headersLength;
      const payloadEnd = totalLength - 4;
      const headers = parseEventHeaders(frame.subarray(headersStart, payloadStart));
      const payloadBytes = frame.subarray(payloadStart, payloadEnd);
      const payloadText = payloadBytes.toString('utf8');
      const payload = payloadText ? JSON.parse(payloadText) : null;

      events.push({
        eventType: typeof headers[':event-type'] === 'string' ? headers[':event-type'] : undefined,
        messageType:
          typeof headers[':message-type'] === 'string' ? headers[':message-type'] : undefined,
        payload,
      });
    }

    return events;
  }

  finish(): void {
    if (this.pending.length > 0) throw new Error('Truncated Kiro event stream');
  }
}

interface OpenAiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface KiroCollectState {
  content: string;
  reasoning: string;
  usage?: OpenAiUsage;
}

function eventPayload(event: KiroEvent): Record<string, unknown> {
  const payload = event.payload;
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  if (event.eventType && record[event.eventType] && typeof record[event.eventType] === 'object') {
    return record[event.eventType] as Record<string, unknown>;
  }
  return record;
}

function numberField(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = readNumber(record[key]);
    if (value !== undefined) return value;
  }
  return 0;
}

function normalizeUsage(value: unknown): OpenAiUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const usage = value as Record<string, unknown>;
  const prompt =
    numberField(usage, 'prompt_tokens', 'inputTokens', 'input_tokens') ||
    numberField(usage, 'uncachedInputTokens', 'uncached_input_tokens') +
      numberField(usage, 'cacheReadInputTokens', 'cache_read_input_tokens') +
      numberField(usage, 'cacheWriteInputTokens', 'cache_write_input_tokens');
  const completion = numberField(usage, 'completion_tokens', 'outputTokens', 'output_tokens');
  const total =
    numberField(usage, 'total_tokens', 'totalTokens', 'total_tokens') || prompt + completion;

  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
  };
}

function extractErrorMessage(event: KiroEvent): string | null {
  const payload = eventPayload(event);
  const message = payload.message ?? payload.errorMessage ?? payload.error;
  return typeof message === 'string' ? message : null;
}

function applyKiroEvent(state: KiroCollectState, event: KiroEvent): Record<string, unknown> | null {
  const eventType = event.eventType?.toLowerCase() ?? '';
  const payload = eventPayload(event);

  if (event.messageType === 'exception') {
    throw new Error(extractErrorMessage(event) ?? 'Kiro returned an exception event');
  }
  if (eventType.includes('assistantresponse')) {
    const content = typeof payload.content === 'string' ? payload.content : '';
    state.content += content;
    return content ? { content } : null;
  }
  if (eventType.includes('reasoningcontent')) {
    const text = typeof payload.text === 'string' ? payload.text : '';
    state.reasoning += text;
    return text ? { reasoning_content: text } : null;
  }
  if (eventType.includes('metadata')) {
    state.usage = normalizeUsage(payload.tokenUsage ?? payload.token_usage);
  }
  return null;
}

function openAiChunk(
  model: string,
  delta: Record<string, unknown>,
  finishReason: string | null = null,
  usage?: OpenAiUsage,
): string {
  return `data: ${JSON.stringify({
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
    ...(usage ? { usage } : {}),
  })}\n\n`;
}

export function createKiroOpenAiStream(
  source: ReadableStream<Uint8Array>,
  model: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const parser = new KiroEventStreamParser();
  const state: KiroCollectState = { content: '', reasoning: '' };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of parser.push(value)) {
            const delta = applyKiroEvent(state, event);
            if (delta) controller.enqueue(encoder.encode(openAiChunk(model, delta)));
          }
        }
        parser.finish();
        controller.enqueue(encoder.encode(openAiChunk(model, {}, 'stop', state.usage)));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

async function collectKiroCompletion(
  source: ReadableStream<Uint8Array>,
  model: string,
): Promise<Record<string, unknown>> {
  const parser = new KiroEventStreamParser();
  const state: KiroCollectState = { content: '', reasoning: '' };
  const reader = source.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const event of parser.push(value)) {
      applyKiroEvent(state, event);
    }
  }
  parser.finish();

  const message: Record<string, unknown> = {
    role: 'assistant',
    content: state.content,
  };
  if (state.reasoning) message.reasoning_content = state.reasoning;

  return {
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: 'stop' }],
    ...(state.usage ? { usage: state.usage } : {}),
  };
}

export async function forwardKiroChat(opts: {
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
  stream: boolean;
  signal?: AbortSignal;
  timeoutMs: number;
  extraHeaders?: Record<string, string>;
}): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(opts.timeoutMs);
  const fetchSignal = opts.signal ? AbortSignal.any([timeoutSignal, opts.signal]) : timeoutSignal;
  const headers = {
    ...buildKiroHeaders(opts.apiKey, KIRO_CHAT_TARGET),
    'x-amzn-kiro-agent-mode': KIRO_AGENT_MODE,
    ...opts.extraHeaders,
  };
  const upstream = await fetch(KIRO_BASE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildKiroChatRequest(opts.body, opts.model)),
    signal: fetchSignal,
    redirect: 'error',
  });

  if (!upstream.ok || !upstream.body) return upstream;
  if (opts.stream) {
    return new Response(createKiroOpenAiStream(upstream.body, opts.model), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const completion = await collectKiroCompletion(upstream.body, opts.model);
  return new Response(JSON.stringify(completion), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
