import { unwrapCodeAssistStreamPayload } from '../oauth/gemini/codeassist-envelope';
import { createSsePayloadParser, DEFAULT_MAX_SSE_BUFFER_SIZE } from './sse-parser';

export interface GoogleResponseQualifierOptions {
  codeAssistEnvelope: boolean;
  timeoutMs: number;
  maxBufferSize?: number;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePayload(payload: string, codeAssistEnvelope: boolean): JsonRecord | null {
  const dataLines = payload
    .split('\n')
    .filter((line) => !line.startsWith('event: ') && !line.startsWith('id: '));
  const raw = dataLines.join('\n');
  try {
    const parsed = JSON.parse(
      codeAssistEnvelope ? unwrapCodeAssistStreamPayload(raw) : raw,
    ) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

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
): Response {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  return new Response(
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
    // The qualifier replaces the provider body, so cancellation is best-effort.
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

function parts(payload: JsonRecord): JsonRecord[] {
  if (!Array.isArray(payload.candidates)) return [];
  return payload.candidates.filter(isRecord).flatMap((candidate) => {
    const content = isRecord(candidate.content) ? candidate.content : null;
    return Array.isArray(content?.parts) ? content.parts.filter(isRecord) : [];
  });
}

function hasMeaningfulOutput(payload: JsonRecord): boolean {
  return parts(payload).some((part) => {
    if (part.thought === true) return false;
    if (typeof part.text === 'string' && part.text.trim()) return true;
    const functionCall = isRecord(part.functionCall) ? part.functionCall : null;
    return typeof functionCall?.name === 'string' && Boolean(functionCall.name.trim());
  });
}

function hasTerminalCandidate(payload: JsonRecord): boolean {
  return (
    Array.isArray(payload.candidates) &&
    payload.candidates
      .filter(isRecord)
      .some(
        (candidate) =>
          typeof candidate.finishReason === 'string' && Boolean(candidate.finishReason),
      )
  );
}

function providerError(payload: JsonRecord): { status: number; message: string } | null {
  if (!isRecord(payload.error)) return null;
  const rawStatus = Number(payload.error.code);
  const status =
    Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 502;
  const message =
    typeof payload.error.message === 'string' && payload.error.message
      ? payload.error.message
      : 'Google provider stream failed';
  return { status, message };
}

/**
 * Google and CodeAssist can encode a failed/empty generation inside an HTTP
 * 200 SSE stream. Hold only the non-output prefix so fallback selection can
 * advance to the next provider when the stream terminates before producing
 * client-visible text or a tool call. Once meaningful output arrives, replay
 * every original byte and resume normal streaming without buffering the turn.
 */
export async function qualifyGoogleResponse(
  response: Response,
  options: GoogleResponseQualifierOptions,
): Promise<Response> {
  if (!response.ok) return response;
  if (!response.body) {
    return errorResponse(
      response,
      502,
      'Google provider returned an empty response body',
      'empty_response',
    );
  }

  const maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_SSE_BUFFER_SIZE;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSsePayloadParser({ maxBufferSize });
  const buffered: Uint8Array[] = [];
  let bufferedSize = 0;
  const deadline = performance.now() + options.timeoutMs;

  const inspect = async (payloads: string[]): Promise<Response | null> => {
    for (const raw of payloads) {
      const payload = parsePayload(raw, options.codeAssistEnvelope);
      if (!payload) continue;
      const error = providerError(payload);
      if (error) {
        await discard(reader);
        return errorResponse(response, error.status, error.message, 'upstream_stream_error');
      }
      if (hasMeaningfulOutput(payload)) {
        return responseWithBody(response, replayStream(reader, buffered));
      }
      if (hasTerminalCandidate(payload)) {
        await discard(reader);
        return errorResponse(
          response,
          502,
          'Google provider completed without text or tool output',
          'empty_response',
        );
      }
    }
    return null;
  };

  try {
    while (true) {
      const remainingMs = Math.max(0, deadline - performance.now());
      const read = await readWithTimeout(reader, remainingMs);
      if (!read) {
        await discard(reader);
        return errorResponse(
          response,
          504,
          `Google provider produced no text or tool output within ${options.timeoutMs}ms`,
          'stream_timeout',
        );
      }
      if (read.done) {
        const tail = decoder.decode();
        const qualified = await inspect([...parser.feed(tail), ...parser.flush()]);
        if (qualified) return qualified;
        reader.releaseLock();
        return errorResponse(
          response,
          502,
          'Google provider ended without text or tool output',
          'empty_response',
        );
      }

      bufferedSize += read.value.byteLength;
      if (bufferedSize > maxBufferSize) {
        await discard(reader);
        return errorResponse(
          response,
          502,
          'Google provider produced too much non-output stream data',
          'stream_buffer_overflow',
        );
      }
      buffered.push(read.value);
      const qualified = await inspect(parser.feed(decoder.decode(read.value, { stream: true })));
      if (qualified) return qualified;
    }
  } catch {
    await discard(reader);
    return errorResponse(
      response,
      502,
      'Google provider stream failed before producing output',
      'upstream_stream_error',
    );
  }
}
