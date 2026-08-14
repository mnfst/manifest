import { randomUUID } from 'node:crypto';

/**
 * Command Code (commandcode.ai) chat adapter — CLI-dialect translation.
 *
 * Command Code's Provider API (`/provider/v1/chat/completions`) is OpenAI-
 * compatible and upstream Manifest talks to it directly. This adapter exists
 * so the subscription ALSO works through the Command Code CLI wire format
 * (the surface 9router/OmniRoute use), independent of the Provider API's chat
 * endpoints: the CLI dials `POST /alpha/generate` with a `user_...` key, a
 * custom request envelope, and an AI-SDK-v5 NDJSON streaming response that is
 * NOT OpenAI-compatible.
 *
 * Wire contract (verified against 9router's live-tested implementation):
 * - request: `{ threadId, memory: "", config: {...}, params: { model,
 *   messages, stream: true, max_tokens, temperature, top_p?, system?,
 *   tools? } }`
 *   - system prompt is a TOP-LEVEL `params.system` STRING (system messages are
 *     not allowed inside `messages[]`)
 *   - message content is ALWAYS an array of blocks: `{type:"text",text}`,
 *     assistant `{type:"tool-call", toolCallId, toolName, input}`, user/tool
 *     `{type:"tool-result", toolCallId, toolName, output}`
 *   - tools are Anthropic-shaped `{name, description, input_schema}`
 * - headers: `Authorization: Bearer <user_...>`, `x-command-code-version`,
 *   `x-cli-environment: cli`, `x-session-id` (fresh per request)
 * - response: NDJSON, one AI SDK v5 event per line (no `data:` prefix):
 *   `{"type":"start"}`, `{"type":"text-delta","text":...}`,
 *   `{"type":"reasoning-delta","text":...}`,
 *   `{"type":"tool-input-start","id","toolName"}`,
 *   `{"type":"tool-input-delta","id","delta"}`,
 *   `{"type":"tool-call","toolCallId","toolName","input"}`,
 *   `{"type":"finish-step","finishReason","usage":{inputTokens,outputTokens,totalTokens}}`,
 *   `{"type":"finish","totalUsage":...}`, `{"type":"error","error":...}`
 *
 * This module translates both directions (OpenAI request → Command Code
 * envelope; NDJSON stream → OpenAI SSE) so the rest of the proxy treats
 * Command Code like any other OpenAI-compatible provider.
 */

export const COMMAND_CODE_CHAT_URL = 'https://api.commandcode.ai/alpha/generate';
export const COMMAND_CODE_CLI_VERSION = '0.25.7';
/** Mirrors the 9router runtime default for /alpha/generate max_tokens. */
export const DEFAULT_COMMAND_CODE_MAX_TOKENS = 64000;

/* ── Request translation: OpenAI → /alpha/generate ── */

interface OpenAiMessage {
  role?: string;
  content?: unknown;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id?: string;
    function?: { name?: string; arguments?: unknown };
  }>;
}

interface OpenAiTool {
  type?: string;
  function?: { name?: string; description?: string; parameters?: unknown };
  name?: string;
  description?: string;
  input_schema?: unknown;
  parameters?: unknown;
}

function flattenText(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        const record = part as Record<string, unknown>;
        return typeof record.text === 'string' ? record.text : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(content);
}

function toContentBlocks(content: unknown): Array<Record<string, unknown>> {
  if (content == null) return [{ type: 'text', text: '' }];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (Array.isArray(content)) {
    const blocks: Array<Record<string, unknown>> = [];
    for (const part of content) {
      if (typeof part === 'string') {
        blocks.push({ type: 'text', text: part });
      } else if (part && typeof part === 'object') {
        const record = part as Record<string, unknown>;
        if (record.type === 'text' && typeof record.text === 'string') {
          blocks.push({ type: 'text', text: record.text });
        } else if (record.type === 'image_url' || record.type === 'image') {
          blocks.push({ type: 'text', text: '[image omitted]' });
        } else if (typeof record.text === 'string') {
          blocks.push({ type: 'text', text: record.text });
        }
      }
    }
    return blocks.length > 0 ? blocks : [{ type: 'text', text: '' }];
  }
  return [{ type: 'text', text: String(content) }];
}

function safeParseJson(value: unknown): unknown {
  if (value == null) return {};
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function convertTools(tools: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(tools)) return undefined;
  const result: Array<Record<string, unknown>> = [];
  for (const raw of tools) {
    if (!raw || typeof raw !== 'object') continue;
    const tool = raw as OpenAiTool;
    if (tool.type === 'function' && tool.function?.name) {
      result.push({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters ?? { type: 'object' },
      });
    } else if (tool.name && (tool.input_schema || tool.parameters)) {
      result.push({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema ?? tool.parameters,
      });
    }
  }
  return result.length > 0 ? result : undefined;
}

function convertMessages(messages: OpenAiMessage[]): {
  messages: Array<Record<string, unknown>>;
  system: string;
} {
  const out: Array<Record<string, unknown>> = [];
  const systemTexts: string[] = [];

  for (const message of messages) {
    if (!message) continue;
    const role = message.role;

    if (role === 'system' || role === 'developer') {
      const text = flattenText(message.content);
      if (text) systemTexts.push(text);
      continue;
    }

    if (role === 'tool') {
      const value =
        typeof message.content === 'string' ? message.content : flattenText(message.content);
      out.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: message.tool_call_id ?? '',
            toolName: message.name ?? '',
            output: value,
          },
        ],
      });
      continue;
    }

    const blocks = toContentBlocks(message.content);
    if (role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        blocks.push({
          type: 'tool-call',
          toolCallId: toolCall.id ?? '',
          toolName: toolCall.function?.name ?? '',
          input: safeParseJson(toolCall.function?.arguments),
        });
      }
    }
    out.push({ role, content: blocks });
  }

  return { messages: out, system: systemTexts.join('\n\n') };
}

/**
 * Translate an OpenAI-shaped chat body into the /alpha/generate request
 * envelope. Streaming is always forced upstream (AI SDK v5 stream), so a
 * non-streaming caller still gets the translated JSON completion back.
 */
export function buildCommandCodeChatRequest(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const rawMessages = Array.isArray(body.messages) ? (body.messages as OpenAiMessage[]) : [];
  const { messages, system } = convertMessages(rawMessages);
  const params: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    max_tokens: (body.max_tokens ??
      body.max_output_tokens ??
      DEFAULT_COMMAND_CODE_MAX_TOKENS) as number,
    temperature: (body.temperature ?? 0.3) as number,
  };

  if (system) params.system = system;
  const tools = convertTools(body.tools);
  if (tools) params.tools = tools;
  if (body.top_p != null) params.top_p = body.top_p;

  const today = new Date().toISOString().slice(0, 10);

  return {
    threadId: randomUUID(),
    memory: '',
    config: {
      workingDir: process.cwd(),
      date: today,
      environment: process.platform,
      structure: [],
      isGitRepo: false,
      currentBranch: '',
      mainBranch: '',
      gitStatus: '',
      recentCommits: [],
    },
    params,
  };
}

export function buildCommandCodeHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'x-command-code-version': COMMAND_CODE_CLI_VERSION,
    'x-cli-environment': 'cli',
    'x-session-id': randomUUID(),
    Accept: 'text/event-stream',
  };
}

/* ── Response translation: AI SDK v5 NDJSON → OpenAI ── */

interface CommandCodeStreamState {
  responseId: string;
  created: number;
  model: string;
  chunkIndex: number;
  toolIndex: number;
  toolIndexById: Map<string, number>;
  finishReason: string | null;
  usage: Record<string, unknown> | null;
}

const OPENAI_FINISH = {
  STOP: 'stop',
  LENGTH: 'length',
  TOOL_CALLS: 'tool_calls',
  CONTENT_FILTER: 'content_filter',
} as const;

function mapFinishReason(reason: string | undefined): string {
  switch (reason) {
    case 'stop':
      return OPENAI_FINISH.STOP;
    case 'length':
      return OPENAI_FINISH.LENGTH;
    case 'tool-calls':
    case 'tool_use':
      return OPENAI_FINISH.TOOL_CALLS;
    case 'content-filter':
      return OPENAI_FINISH.CONTENT_FILTER;
    case 'error':
      return OPENAI_FINISH.STOP;
    default:
      return reason || OPENAI_FINISH.STOP;
  }
}

function ensureState(
  state: CommandCodeStreamState | undefined,
  model: string,
): CommandCodeStreamState {
  if (!state || !state.responseId) {
    return {
      responseId: `chatcmpl-${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      model: model || 'commandcode',
      chunkIndex: 0,
      toolIndex: 0,
      toolIndexById: new Map(),
      finishReason: null,
      usage: null,
    };
  }
  return state;
}

function buildChunk(
  state: CommandCodeStreamState,
  delta: Record<string, unknown>,
  finishReason: string | null = null,
): Record<string, unknown> {
  return {
    id: state.responseId,
    object: 'chat.completion.chunk',
    created: state.created,
    model: state.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

/** Command Code usage: { inputTokens, outputTokens, totalTokens }. */
function toOpenAIUsage(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const usage = raw as Record<string, unknown>;
  const input = typeof usage.inputTokens === 'number' ? usage.inputTokens : 0;
  const output = typeof usage.outputTokens === 'number' ? usage.outputTokens : 0;
  const total = typeof usage.totalTokens === 'number' ? usage.totalTokens : input + output;
  return { prompt_tokens: input, completion_tokens: output, total_tokens: total };
}

function parseEventLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '[DONE]') return null;
  // Tolerate `data: {...}` framing in case the upstream wrapper inserts it.
  const json = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Translate ONE Command Code NDJSON event line into zero or more OpenAI
 * `chat.completion.chunk` objects, using the shared per-request state.
 */
export function commandCodeLineToOpenAiChunks(
  line: string,
  state: CommandCodeStreamState,
  model: string,
): Array<Record<string, unknown>> | null {
  const event = parseEventLine(line);
  if (!event || typeof event.type !== 'string') return null;

  const st = ensureState(state, (event.model as string) || model);
  const out: Array<Record<string, unknown>> = [];

  switch (event.type) {
    case 'text-delta': {
      const text = typeof event.text === 'string' ? event.text : (event.delta ?? '');
      if (!text) break;
      const delta = st.chunkIndex === 0 ? { role: 'assistant', content: text } : { content: text };
      st.chunkIndex++;
      out.push(buildChunk(st, delta));
      break;
    }
    case 'reasoning-delta': {
      const text = typeof event.text === 'string' ? event.text : '';
      if (!text) break;
      // Map reasoning to OpenAI's `reasoning_content` (deepseek-reasoner-style).
      const delta =
        st.chunkIndex === 0
          ? { role: 'assistant', reasoning_content: text }
          : { reasoning_content: text };
      st.chunkIndex++;
      out.push(buildChunk(st, delta));
      break;
    }
    case 'tool-input-start': {
      const id =
        typeof event.id === 'string'
          ? event.id
          : ((event.toolCallId as string) ?? fallbackToolCallId(st.toolIndex));
      let index = st.toolIndexById.get(id);
      if (index == null) {
        index = st.toolIndex++;
        st.toolIndexById.set(id, index);
      }
      out.push(
        buildChunk(st, {
          ...(st.chunkIndex === 0 ? { role: 'assistant' } : {}),
          tool_calls: [
            {
              index,
              id,
              type: 'function',
              function: { name: (event.toolName as string) ?? '', arguments: '' },
            },
          ],
        }),
      );
      st.chunkIndex++;
      break;
    }
    case 'tool-input-delta': {
      const id = (event.id as string) ?? (event.toolCallId as string);
      const index = id ? st.toolIndexById.get(id) : undefined;
      if (index == null) break;
      out.push(
        buildChunk(st, {
          tool_calls: [
            {
              index,
              function: {
                arguments: (event.delta as string) ?? (event.inputTextDelta as string) ?? '',
              },
            },
          ],
        }),
      );
      break;
    }
    case 'tool-call': {
      // Final consolidated tool call — only emit if we never saw tool-input-*.
      const id = event.toolCallId as string;
      if (id && st.toolIndexById.has(id)) break;
      const index = st.toolIndex++;
      if (id) st.toolIndexById.set(id, index);
      const argsStr =
        typeof event.input === 'string' ? event.input : JSON.stringify(event.input ?? {});
      out.push(
        buildChunk(st, {
          ...(st.chunkIndex === 0 ? { role: 'assistant' } : {}),
          tool_calls: [
            {
              index,
              id: id ?? fallbackToolCallId(index),
              type: 'function',
              function: { name: (event.toolName as string) ?? '', arguments: argsStr },
            },
          ],
        }),
      );
      st.chunkIndex++;
      break;
    }
    case 'finish-step': {
      if (typeof event.finishReason === 'string') {
        st.finishReason = mapFinishReason(event.finishReason);
      }
      if (event.usage && typeof event.usage === 'object') {
        st.usage = event.usage as Record<string, unknown>;
      }
      break;
    }
    case 'finish': {
      const finishReason = st.finishReason ?? mapFinishReason(event.finishReason as string);
      const finalChunk = buildChunk(st, {}, finishReason);
      const usage = toOpenAIUsage(event.totalUsage ?? st.usage);
      if (usage) finalChunk.usage = usage;
      out.push(finalChunk);
      break;
    }
    case 'error': {
      const errorValue = event.error ?? event.message ?? 'unknown';
      const errorText = typeof errorValue === 'string' ? errorValue : JSON.stringify(errorValue);
      out.push(buildChunk(st, { content: `\n\n[CommandCode error: ${errorText}]` }));
      out.push(buildChunk(st, {}, OPENAI_FINISH.STOP));
      break;
    }
    default:
      // Silently ignore: start, start-step, reasoning-start, reasoning-end,
      // text-start, text-end, provider-metadata, message-metadata, etc.
      break;
  }

  return out.length > 0 ? out : null;
}

function fallbackToolCallId(index: number): string {
  return `call_${index}_${Date.now()}`;
}

const SSE_DONE = 'data: [DONE]\n\n';

/**
 * Wrap the upstream NDJSON body as an OpenAI-compatible SSE stream of
 * `chat.completion.chunk` objects.
 */
export function createCommandCodeOpenAiStream(
  source: ReadableStream<Uint8Array>,
  model: string,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let state: CommandCodeStreamState | undefined;

  const emit = (
    chunks: Array<Record<string, unknown>> | null,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): void => {
    if (!chunks) return;
    for (const chunk of chunks) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
    }
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            emit(commandCodeLineToOpenAiChunks(line, state!, model), controller);
            if (!state) state = ensureState(state, model);
          }
        }
        const trailing = buffer.trim();
        if (trailing) emit(commandCodeLineToOpenAiChunks(trailing, state!, model), controller);
        if (!state) state = ensureState(state, model);
        controller.enqueue(encoder.encode(SSE_DONE));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/* ── Non-streaming: collect the forced stream into a chat.completion JSON ── */

async function* commandCodeLines(source: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  const reader = source.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) yield line;
    }
  }
  if (buffer.trim()) yield buffer;
}

export async function collectCommandCodeCompletion(
  source: ReadableStream<Uint8Array>,
  model: string,
): Promise<Record<string, unknown>> {
  const state = ensureState(undefined, model);
  let content = '';
  let reasoning = '';
  const toolCalls: Array<{
    id?: string;
    type: string;
    function: { name?: string; arguments: string };
  }> = [];
  let toolCallById = new Map<string, number>();
  let finishReason: string | null = null;
  let usage: Record<string, unknown> | null = null;

  for await (const line of commandCodeLines(source)) {
    const chunks = commandCodeLineToOpenAiChunks(line, state, model);
    if (!chunks) continue;
    for (const chunk of chunks) {
      const choices = chunk.choices as
        Array<{ delta?: Record<string, unknown>; finish_reason?: unknown }> | undefined;
      const delta = choices?.[0]?.delta ?? {};
      if (typeof delta.content === 'string') content += delta.content;
      if (typeof delta.reasoning_content === 'string') reasoning += delta.reasoning_content;
      const callDeltas = delta.tool_calls as
        | Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
        | undefined;
      if (callDeltas) {
        for (const callDelta of callDeltas) {
          const index = callDelta.index ?? toolCalls.length;
          let call = toolCalls[index];
          if (!call) {
            call = { type: 'function', function: { arguments: '' } };
            toolCalls[index] = call;
            if (callDelta.id) toolCallById.set(callDelta.id, index);
          }
          if (callDelta.id && callDelta.function?.name) {
            call.id = callDelta.id;
            call.function.name = callDelta.function.name;
            toolCallById.set(callDelta.id, index);
          }
          if (callDelta.function?.name && !call.function.name) {
            call.function.name = callDelta.function.name;
          }
          if (callDelta.function?.arguments) {
            call.function.arguments += callDelta.function.arguments;
          }
        }
      }
      if (choices?.[0] && typeof choices[0].finish_reason === 'string') {
        finishReason = choices[0].finish_reason;
      }
      if (chunk.usage && typeof chunk.usage === 'object') {
        usage = chunk.usage as Record<string, unknown>;
      }
    }
  }

  const message: Record<string, unknown> = { role: 'assistant', content };
  if (reasoning) message.reasoning_content = reasoning;
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  return {
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion',
    created: state.created,
    model,
    choices: [{ index: 0, message, finish_reason: finishReason ?? 'stop' }],
    ...(usage ? { usage } : {}),
  };
}

/* ── Forwarder ── */

export async function forwardCommandCodeChat(opts: {
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
  const upstream = await fetch(COMMAND_CODE_CHAT_URL, {
    method: 'POST',
    headers: { ...buildCommandCodeHeaders(opts.apiKey), ...opts.extraHeaders },
    body: JSON.stringify(buildCommandCodeChatRequest(opts.body, opts.model)),
    signal: fetchSignal,
    redirect: 'error',
  });

  if (!upstream.ok || !upstream.body) return upstream;
  if (opts.stream) {
    return new Response(createCommandCodeOpenAiStream(upstream.body, opts.model), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const completion = await collectCommandCodeCompletion(upstream.body, opts.model);
  return new Response(JSON.stringify(completion), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
