import { isObjectRecord, safeParse } from './chatgpt-helpers';
import { createSsePayloadParser } from './sse-parser';

/**
 * Qualifier for standard `/v1/chat/completions` responses (OpenAI-compatible
 * wire format).
 *
 * A provider can report protocol success (HTTP 200) while producing no useful
 * output — no `content`, no `tool_calls` — typically during an upstream
 * incident (observed with `minimax-m3` on `ollama-cloud`). Without this check
 * the proxy records those attempts as `success` and never advances
 * `fallback_index`, so the empty generation is served to the caller as the
 * terminal answer.
 *
 * This module mirrors the mechanism of `qualifyChatGptResponse` (see PR #2546,
 * commit 4e6e74a): it intervenes *before* the fallback decision point and, when
 * the body carries no deliverable output, rewrites the `Response` into a
 * synthetic HTTP failure. The existing `shouldTriggerFallback(status >= 400)`
 * then picks it up and advances the fallback chain — no second exit-success
 * branch is introduced anywhere in the routing logic.
 *
 * The qualifier also understands native wire formats (Anthropic Messages,
 * Google Generate Content, Responses API) because those responses are
 * converted to the same OpenAI chat-completion shape downstream and can also
 * return HTTP 200 with empty content.
 */

export const DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS = 60_000;
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Parse `EMPTY_RESPONSE_TIMEOUT_MS` (the deadline a streaming response may
 * take before it is declared empty) with the same validation pattern as
 * `CODEX_SEMANTIC_OUTPUT_TIMEOUT_MS`. Falls back to a safe default when the
 * value is missing, non-numeric, or outside the safe timer range.
 */
export function parseEmptyResponseTimeoutMs(
  rawValue = process.env.EMPTY_RESPONSE_TIMEOUT_MS,
): number {
  const value = rawValue ?? '';
  if (!/^\d+$/.test(value)) return DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_TIMER_MS
    ? parsed
    : DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS;
}

const EMPTY_RESPONSE_TIMEOUT_MS = parseEmptyResponseTimeoutMs();

const encoder = new TextEncoder();

function responseWithBody(response: Response, body: BodyInit): Response {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function errorResponse(
  response: Response,
  status: number,
  message: string,
  code: string,
  body?: string,
): Response {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  return new Response(
    body ??
      JSON.stringify({
        error: { message, type: 'upstream_response_error', code },
      }),
    { status, headers },
  );
}

function replayStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buffered: Uint8Array[],
): ReadableStream<Uint8Array> {
  const release = () => reader.releaseLock();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of buffered) controller.enqueue(chunk);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
        } else if (value) {
          controller.enqueue(value);
        }
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        release();
      }
    },
  });
}

async function discard(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The qualifier is replacing this body, so a cancellation failure is immaterial.
  } finally {
    reader.releaseLock();
  }
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array> | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

interface ChatCompletionMessage {
  content?: unknown;
  tool_calls?: unknown;
}

/**
 * A non-streaming message is deliverable when it carries either real text
 * (non-empty after trimming) or at least one tool call. An assistant message
 * may legitimately have empty content alongside tool calls — that is not an
 * empty response.
 */
function hasDeliverableMessage(message: ChatCompletionMessage | undefined): boolean {
  if (!message) return false;
  if (typeof message.content === 'string' && message.content.trim().length > 0) return true;
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

/**
 * Detect deliverable content in an Anthropic Messages non-streaming payload.
 * A `text` block with non-empty text or a `tool_use` block counts as
 * deliverable.
 */
function hasDeliverableAnthropicContent(payload: Record<string, unknown>): boolean {
  const content = Array.isArray(payload.content) ? payload.content : [];
  for (const block of content) {
    if (!isObjectRecord(block)) continue;
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim().length > 0) {
      return true;
    }
    if (block.type === 'tool_use') return true;
  }
  return false;
}

/**
 * Detect deliverable content in a Google Generate Content non-streaming
 * payload. A `text` part (excluding `thought` parts) or a `functionCall` part
 * counts as deliverable. Also handles the CodeAssist envelope shape
 * `{ response: { candidates: [...] } }`.
 */
function hasDeliverableGoogleContent(payload: Record<string, unknown>): boolean {
  const inner = isObjectRecord(payload.response) ? payload.response : payload;
  const candidates = Array.isArray(inner.candidates) ? inner.candidates : [];
  if (candidates.length === 0) return false;
  const first = isObjectRecord(candidates[0]) ? candidates[0] : undefined;
  if (!first) return false;
  const content = isObjectRecord(first.content) ? first.content : undefined;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  for (const part of parts) {
    if (!isObjectRecord(part)) continue;
    if (typeof part.text === 'string' && part.text.trim().length > 0 && !part.thought) return true;
    if (part.functionCall) return true;
  }
  return false;
}

/**
 * Extract the assistant message from a non-streaming chat completion payload.
 * Handles both the standard `choices[].message` shape and the degenerate
 * `choices: []` / `choices: [undefined]` cases that some providers emit.
 */
function nonStreamingMessage(payload: Record<string, unknown>): ChatCompletionMessage | undefined {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  if (choices.length === 0) return undefined;
  const first = isObjectRecord(choices[0]) ? choices[0] : undefined;
  if (!first) return undefined;
  return isObjectRecord(first.message) ? first.message : undefined;
}

/**
 * A Responses API output item is a deliverable tool call when its type is one
 * of the native tool item shapes: `function_call`, `web_search_call`,
 * `computer_call`, `code_interpreter_call`, or `file_search_call`. These all
 * represent real tool invocations delivered to the caller even when no
 * `output_text` accompanies them. `reasoning` items are explicitly excluded —
 * they carry only chain-of-thought and are not deliverable output.
 */
function isDeliverableResponsesToolItem(item: Record<string, unknown>): boolean {
  return (
    item.type === 'function_call' ||
    item.type === 'web_search_call' ||
    item.type === 'computer_call' ||
    item.type === 'code_interpreter_call' ||
    item.type === 'file_search_call'
  );
}

/**
 * Detect deliverable content in a Responses API non-streaming payload.
 * `output` items of type `message` carry text via `content[].output_text`
 * parts, and native tool items (`function_call`, `web_search_call`,
 * `computer_call`, `code_interpreter_call`, `file_search_call`) count as
 * tool calls. Valid natively-shaped Responses JSON has no `choices`, so
 * without this branch every successful Responses response would be rewritten
 * to a 502 and trigger fallback (see provider-client `qualifyEmptyResponse`
 * wiring for non-subscription Responses endpoints).
 */
function hasDeliverableResponsesPayload(payload: Record<string, unknown>): boolean {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isObjectRecord(item)) continue;
    if (isDeliverableResponsesToolItem(item)) return true;
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (
        isObjectRecord(part) &&
        part.type === 'output_text' &&
        typeof part.text === 'string' &&
        part.text.trim().length > 0
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Determine whether a non-streaming payload carries deliverable output across
 * any supported wire format:
 * - OpenAI chat completions: `choices[].message.content` / `tool_calls`
 * - Anthropic Messages: `content[]` text / tool_use blocks
 * - Google Generate Content: `candidates[].content.parts[]` text / functionCall
 * - Responses API: `output[]` messages (`output_text`) / function_call
 */
function hasDeliverableNonStreamingPayload(payload: Record<string, unknown>): boolean {
  if (hasDeliverableMessage(nonStreamingMessage(payload))) return true;
  if (hasDeliverableAnthropicContent(payload)) return true;
  if (hasDeliverableGoogleContent(payload)) return true;
  if (hasDeliverableResponsesPayload(payload)) return true;
  return false;
}

async function qualifyNonStreaming(
  response: Response,
  timeoutMs: number = EMPTY_RESPONSE_TIMEOUT_MS,
): Promise<Response> {
  // Clone so consuming the body for inspection does not mark the original
  // as "already read" — downstream consumers (and retryWireBody) still need
  // to read it untouched. If the body was already consumed upstream (a
  // previously-read response replayed through retryWireBody), we cannot
  // inspect it — pass it through unchanged rather than failing.
  let text: string;
  try {
    text = await response.clone().text();
  } catch {
    return response;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return errorResponse(
      response,
      502,
      'Provider returned an empty response body',
      'empty_response',
    );
  }

  // A provider may stream real content but omit or mislabel the
  // `content-type` header (e.g. `application/json`). Detect SSE framing and
  // qualify as streaming instead of failing JSON parsing below. The `[DONE]`
  // sentinel is only meaningful when it actually appears on a `data:` line —
  // a valid non-streaming completion whose text happens to contain `[DONE]`
  // must not be misclassified as SSE.
  const hasSseDoneSentinel = /^data:\s*\[DONE\]\s*$/m.test(trimmed);
  if (trimmed.startsWith('data:') || trimmed.startsWith('event:') || hasSseDoneSentinel) {
    return qualifyStreaming(response, timeoutMs);
  }

  const parsed = safeParse(trimmed);
  if (!parsed) {
    // A non-JSON 200 body is not a valid chat completion; treat it as a
    // provider failure rather than guessing. The original body is preserved in
    // the synthetic error payload for diagnostics.
    return errorResponse(
      response,
      502,
      'Provider returned a non-JSON response body',
      'empty_response',
      JSON.stringify({
        error: {
          message: 'Provider returned a non-JSON response body',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
        raw_body: trimmed.slice(0, 4_000),
      }),
    );
  }

  if (!hasDeliverableNonStreamingPayload(parsed)) {
    return errorResponse(
      response,
      502,
      'Provider returned a chat completion without content or tool calls',
      'empty_response',
      JSON.stringify({
        error: {
          message: 'Provider returned a chat completion without content or tool calls',
          type: 'upstream_response_error',
          code: 'empty_response',
        },
        raw_body: trimmed.slice(0, 4_000),
      }),
    );
  }

  // Deliverable: replay the consumed body so downstream consumers still see it.
  return responseWithBody(response, encoder.encode(text));
}

/**
 * A streaming chunk is deliverable when it carries either real text
 * (`choices[0].delta.content`) or at least one tool call
 * (`choices[0].delta.tool_calls`). The standard SSE shape for
 * `chat.completion.chunk` is used; the degenerate `choices: []` /
 * `choices: [undefined]` cases are treated as not deliverable.
 *
 * Native wire formats are also recognized:
 * - Anthropic Messages: `content_block_delta` with `text_delta`, or
 *   `content_block_start` with a `tool_use` block.
 * - Google Generate Content: `candidates[0].content.parts[]` with text or
 *   `functionCall`.
 */
function hasDeliverableChunk(payload: Record<string, unknown>): boolean {
  // OpenAI chat completion chunk
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  if (choices.length > 0) {
    const first = isObjectRecord(choices[0]) ? choices[0] : undefined;
    if (first) {
      const delta = isObjectRecord(first.delta) ? first.delta : undefined;
      if (delta) {
        if (typeof delta.content === 'string' && delta.content.trim().length > 0) return true;
        if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) return true;
      }
    }
  }

  // Anthropic Messages stream event
  if (payload.type === 'content_block_delta') {
    const delta = isObjectRecord(payload.delta) ? payload.delta : undefined;
    if (
      delta &&
      delta.type === 'text_delta' &&
      typeof delta.text === 'string' &&
      delta.text.trim().length > 0
    ) {
      return true;
    }
  }
  if (payload.type === 'content_block_start') {
    const block = isObjectRecord(payload.content_block) ? payload.content_block : undefined;
    if (block && block.type === 'tool_use') return true;
  }

  // Google Generate Content stream chunk
  if (hasDeliverableGoogleContent(payload)) return true;

  // Responses API stream events
  if (payload.type === 'response.output_text.delta') {
    return typeof payload.delta === 'string' && payload.delta.trim().length > 0;
  }
  if (payload.type === 'response.output_item.added') {
    const item = isObjectRecord(payload.item) ? payload.item : undefined;
    return item ? isDeliverableResponsesToolItem(item) : false;
  }

  return false;
}

/**
 * Inspect a list of SSE payload strings and return true if any of them
 * carries deliverable content (text or tool calls).
 *
 * Payloads may be plain JSON (OpenAI chat completions, Google Generate
 * Content) or carry `event:` / `id:` lines alongside `data:` (Anthropic
 * Messages stream events). The JSON is extracted from the `data:` line
 * before parsing.
 */
function hasDeliverablePayload(payloads: string[]): boolean {
  for (const payload of payloads) {
    const lines = payload.split('\n');
    // Extract JSON from SSE payloads that carry event:/id: lines
    // (e.g. Anthropic Messages stream events).
    const jsonLine = lines
      .filter((line) => !line.startsWith('event:') && !line.startsWith('id:'))
      .join('\n');
    const parsed = safeParse(jsonLine);
    if (parsed && hasDeliverableChunk(parsed)) return true;

    // Responses API events may omit `type` inside the JSON payload and rely
    // entirely on the `event:` line (e.g. `data: {"delta":"hi"}` with
    // `event: response.output_text.delta`). Mirror `chatgpt-response-qualifier`
    // and read the event name so valid deltas are not rewritten to a 502.
    const eventLine = lines.find((line) => line.startsWith('event:'));
    const eventName = eventLine?.slice('event:'.length).trim();
    if (eventName === 'response.output_text.delta') {
      if (parsed && typeof parsed.delta === 'string' && parsed.delta.trim().length > 0) {
        return true;
      }
    }
    if (eventName === 'response.output_item.added') {
      const item = parsed && isObjectRecord(parsed.item) ? parsed.item : undefined;
      if (item && isDeliverableResponsesToolItem(item)) return true;
    }
  }
  return false;
}

/**
 * Qualify a streaming response. Reads chunks until either a deliverable chunk
 * is found (in which case the stream is replayed) or the timeout elapses
 * (in which case the response is rewritten as a synthetic 502).
 *
 * Fixes applied:
 * 1. Catches errors from parser.feed() (buffer overflow) and returns upstream_stream_error 502
 * 2. Uses cumulative timeout tracking — timer resets only once at start, not per chunk
 * 3. Calls parser.flush() before declaring stream empty to inspect pending payloads
 * 4. Accepts an injectable timeout for testability
 */
async function qualifyStreaming(
  response: Response,
  timeoutMs: number = EMPTY_RESPONSE_TIMEOUT_MS,
): Promise<Response> {
  const reader = response.body?.getReader();
  if (!reader) {
    return errorResponse(
      response,
      502,
      'Provider returned a streaming response without a readable body',
      'empty_response',
    );
  }

  const buffered: Uint8Array[] = [];
  const parser = createSsePayloadParser();

  // Track cumulative elapsed time for the timeout
  let elapsedMs = 0;

  try {
    while (true) {
      // Use remaining timeout for each read attempt
      const result = await readWithTimeout(reader, Math.max(0, timeoutMs - elapsedMs));
      if (result === null) {
        // Timeout with no deliverable output: treat as empty.
        await discard(reader);
        return errorResponse(
          response,
          502,
          'Provider streamed no content or tool calls before the timeout',
          'empty_response',
        );
      }
      if (result.done) {
        // Stream ended — flush pending payloads before deciding if empty.
        const pendingPayloads = parser.flush();
        // If any pending payloads were deliverable, replay the stream.
        // replayStream takes ownership of the reader and releases the lock
        // itself once the replayed stream is done or cancelled, so we must
        // NOT release the lock here — doing so makes reader.read() throw
        // "reader is not attached to a stream" from replayStream's pull and
        // errores the replayed stream.
        if (hasDeliverablePayload(pendingPayloads)) {
          return responseWithBody(response, replayStream(reader, buffered));
        }
        // Otherwise the stream ended without any deliverable content.
        await discard(reader);
        return errorResponse(
          response,
          502,
          'Provider stream ended without content or tool calls',
          'empty_response',
        );
      }
      if (result.value) {
        buffered.push(result.value);
        const text = new TextDecoder().decode(result.value);
        const payloads = parser.feed(text);
        if (hasDeliverablePayload(payloads)) {
          // Deliverable: replay the consumed chunks so downstream
          // consumers still see the full stream.
          return responseWithBody(response, replayStream(reader, buffered));
        }
        // Update elapsed time tracking
        elapsedMs += timeoutMs;
      }
    }
  } catch (error) {
    // The upstream reader rejected or parser.feed() threw (e.g. SSE buffer
    // overflow). Cancel and release the reader, then return a fallback-
    // classifiable 502 so the existing fallback logic advances the chain.
    await discard(reader);
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(
      response,
      502,
      `Provider stream failed while qualifying: ${message}`,
      'upstream_stream_error',
    );
  }
}

/**
 * Qualify a `/v1/chat/completions` response. Non-streaming responses are
 * inspected as a whole; streaming responses are inspected chunk by chunk.
 * When no deliverable output is found the response is rewritten as a
 * synthetic 502 so the existing fallback logic advances the chain.
 *
 * @param timeoutMs Optional streaming timeout override (used by tests).
 * @param stream Optional request-level stream flag. When true, the response
 *   is always treated as streaming even if the `content-type` header is
 *   missing or mislabeled.
 */
export async function qualifyEmptyResponse(
  response: Response,
  timeoutMs?: number,
  stream?: boolean,
): Promise<Response> {
  if (!response.ok) return response;
  const contentType = response.headers.get('content-type') ?? '';
  const isStreaming = stream === true || contentType.includes('text/event-stream');
  return isStreaming
    ? qualifyStreaming(response, timeoutMs)
    : qualifyNonStreaming(response, timeoutMs);
}
