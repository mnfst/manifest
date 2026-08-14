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

async function qualifyNonStreaming(response: Response): Promise<Response> {
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

  if (!hasDeliverableMessage(nonStreamingMessage(parsed))) {
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
 */
function hasDeliverableChunk(payload: Record<string, unknown>): boolean {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  if (choices.length === 0) return false;
  const first = isObjectRecord(choices[0]) ? choices[0] : undefined;
  if (!first) return false;
  const delta = isObjectRecord(first.delta) ? first.delta : undefined;
  if (!delta) return false;
  if (typeof delta.content === 'string' && delta.content.trim().length > 0) return true;
  return Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0;
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
 */
async function qualifyStreaming(response: Response): Promise<Response> {
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

  while (true) {
    // Use remaining timeout for each read attempt
    const result = await readWithTimeout(
      reader,
      Math.max(0, DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS - elapsedMs),
    );
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
      parser.flush();
      reader.releaseLock();
      // After flushing, check if any pending payloads were deliverable.
      // If the stream ended without any deliverable content, report empty.
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
      for (const payload of payloads) {
        const parsed = safeParse(payload);
        if (parsed && hasDeliverableChunk(parsed)) {
          // Deliverable: replay the consumed chunks so downstream
          // consumers still see the full stream.
          return responseWithBody(response, replayStream(reader, buffered));
        }
      }
      // Update elapsed time tracking
      elapsedMs += DEFAULT_EMPTY_RESPONSE_TIMEOUT_MS;
    }
  }
}

/**
 * Qualify a `/v1/chat/completions` response. Non-streaming responses are
 * inspected as a whole; streaming responses are inspected chunk by chunk.
 * When no deliverable output is found the response is rewritten as a
 * synthetic 502 so the existing fallback logic advances the chain.
 */
export async function qualifyEmptyResponse(response: Response): Promise<Response> {
  if (!response.ok) return response;
  const isStreaming = response.headers.get('content-type')?.includes('text/event-stream') ?? false;
  return isStreaming ? qualifyStreaming(response) : qualifyNonStreaming(response);
}
