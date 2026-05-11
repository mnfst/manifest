import { Response as ExpressResponse } from 'express';

export interface StreamUsage {
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
}

/**
 * Read a usage block in either OpenAI-compat (`prompt_tokens`/`completion_tokens`)
 * or Anthropic-native (`input_tokens`/`output_tokens`) shape and normalise it
 * to a `StreamUsage`. Returns null when neither shape is present.
 *
 * OpenAI-compatible providers expose cached prompt tokens under the nested
 * `prompt_tokens_details.cached_tokens` field, not the top-level
 * `cache_read_tokens` key — DeepSeek, Z.AI, MiniMax, Mistral, etc. all use the
 * nested form. Falling back to the nested key keeps the cache column populated
 * for those providers.
 */
export function parseUsageObject(usage: unknown): StreamUsage | null {
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;

  if (typeof u.prompt_tokens === 'number') {
    const promptDetails =
      typeof u.prompt_tokens_details === 'object' && u.prompt_tokens_details !== null
        ? (u.prompt_tokens_details as Record<string, unknown>)
        : undefined;
    const cacheRead =
      typeof u.cache_read_tokens === 'number'
        ? u.cache_read_tokens
        : typeof promptDetails?.cached_tokens === 'number'
          ? promptDetails.cached_tokens
          : undefined;
    return {
      prompt_tokens: u.prompt_tokens,
      completion_tokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : 0,
      cache_read_tokens: cacheRead,
      cache_creation_tokens:
        typeof u.cache_creation_tokens === 'number' ? u.cache_creation_tokens : undefined,
    };
  }

  if (typeof u.input_tokens === 'number') {
    // Two shapes share this branch:
    //   - Anthropic native (`POST /v1/messages` passthrough): cache reads
    //     and creations live at the top of the usage object as
    //     `cache_read_input_tokens` / `cache_creation_input_tokens`, and
    //     `input_tokens` is the non-cached portion. Total prompt tokens =
    //     input + cache_read + cache_creation, matching what the converted
    //     `fromAnthropicResponse` path used to record.
    //   - OpenAI Responses API: cached count nests under
    //     `input_tokens_details.cached_tokens`, and `input_tokens` is
    //     already the total. No summing here or we'd double-count cache.
    const inputDetails =
      typeof u.input_tokens_details === 'object' && u.input_tokens_details !== null
        ? (u.input_tokens_details as Record<string, unknown>)
        : undefined;
    const nativeCacheRead =
      typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : 0;
    const nativeCacheCreation =
      typeof u.cache_creation_input_tokens === 'number' ? u.cache_creation_input_tokens : 0;
    const isAnthropicNative = nativeCacheRead > 0 || nativeCacheCreation > 0;
    const nestedCacheRead =
      typeof inputDetails?.cached_tokens === 'number' ? inputDetails.cached_tokens : 0;
    const promptTokens = isAnthropicNative
      ? u.input_tokens + nativeCacheRead + nativeCacheCreation
      : u.input_tokens;
    const cacheRead = nativeCacheRead || nestedCacheRead;
    return {
      prompt_tokens: promptTokens,
      completion_tokens: typeof u.output_tokens === 'number' ? u.output_tokens : 0,
      cache_read_tokens: cacheRead || undefined,
      cache_creation_tokens: nativeCacheCreation,
    };
  }

  return null;
}

/** Extract usage data from an SSE-formatted text chunk (e.g. `data: {...}\n\n`). */
export function extractUsageFromSse(sseText: string): StreamUsage | null {
  for (const line of sseText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const json = trimmed.slice(5).trim();
    if (json === '[DONE]') continue;
    try {
      const obj = JSON.parse(json);
      const fromUsage = parseUsageObject(obj.usage);
      if (fromUsage) return fromUsage;
      const fromResponse = parseUsageObject(obj.response?.usage);
      if (fromResponse) return fromResponse;
    } catch {
      /* ignore parse errors */
    }
  }
  return null;
}

export function initSseHeaders(
  res: ExpressResponse,
  extraHeaders: Record<string, string> = {},
): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  res.flushHeaders();
}

/**
 * Parses an SSE text stream into individual event payloads.
 * Handles `data: ` prefixes, multi-event chunks, and partial
 * chunks that split across TCP reads.
 */
export function parseSseEvents(buffer: string): { events: string[]; remaining: string } {
  const events: string[] = [];
  let remaining = buffer;

  // Split on double-newline (SSE event boundary)
  let idx: number;
  while ((idx = remaining.indexOf('\n\n')) !== -1) {
    const raw = remaining.slice(0, idx).trim();
    remaining = remaining.slice(idx + 2);

    if (!raw) continue;

    // Strip "data: " prefix from each line and join
    const payload = raw
      .split('\n')
      .map((line) => (line.startsWith('data: ') ? line.slice(6) : line))
      .join('\n')
      .trim();

    if (payload && payload !== '[DONE]') {
      events.push(payload);
    }
  }

  return { events, remaining };
}

const MAX_SSE_BUFFER_SIZE = 1_048_576;

/**
 * Forward an SSE stream byte-for-byte from `source` to `dest` while running a
 * `tap` parser over the parsed events for telemetry side effects. The wire
 * bytes are written unchanged, so SSE framing (`event:` headers, multi-line
 * `data:` payloads, blank-line separators) is preserved end-to-end. Used by
 * the `/v1/messages` → Anthropic passthrough path where translation must
 * NOT touch the wire format but Manifest still needs to extract usage and
 * cache thinking blocks.
 *
 * The tap receives the same parsed-event shape `pipeStream` would have
 * passed to its `transform`. Its return value (an OpenAI-shape chunk in
 * practice) is parsed for usage; nothing it returns is written to `dest`.
 */
export async function pipePassthrough(
  source: ReadableStream<Uint8Array>,
  dest: ExpressResponse,
  tap: (parsedEvent: string) => string | null,
): Promise<StreamUsage | null> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let capturedUsage: StreamUsage | null = null;

  try {
    let done = false;
    while (!done) {
      if (dest.writableEnded) break;
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        // Write the upstream bytes through unchanged so the client sees
        // intact SSE framing.
        dest.write(Buffer.from(result.value));
        sseBuffer += decoder.decode(result.value, { stream: !done });
        if (sseBuffer.length > MAX_SSE_BUFFER_SIZE) {
          throw new Error('SSE buffer overflow: provider sent data without event boundaries');
        }
        const { events, remaining } = parseSseEvents(sseBuffer);
        sseBuffer = remaining;
        for (const event of events) {
          const tapped = tap(event);
          if (tapped) {
            const usage = extractUsageFromSse(tapped);
            if (usage) capturedUsage = usage;
          }
        }
      }
    }
    // Flush a trailing partial event through the tap so a final usage
    // chunk that the upstream didn't terminate with \n\n isn't lost.
    if (sseBuffer.trim()) {
      const payload = sseBuffer
        .split('\n')
        .map((line) => (line.startsWith('data: ') ? line.slice(6) : line))
        .join('\n')
        .trim();
      if (payload && payload !== '[DONE]') {
        const tapped = tap(payload);
        if (tapped) {
          const usage = extractUsageFromSse(tapped);
          if (usage) capturedUsage = usage;
        }
      }
    }
  } finally {
    if (!dest.writableEnded) dest.end();
    reader.releaseLock();
  }

  return capturedUsage;
}

export async function pipeStream(
  source: ReadableStream<Uint8Array>,
  dest: ExpressResponse,
  transform?: (chunk: string) => string | null,
  finalize?: () => string | null,
): Promise<StreamUsage | null> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let passthroughBuffer = '';
  let capturedUsage: StreamUsage | null = null;

  try {
    let done = false;
    while (!done) {
      if (dest.writableEnded) break;

      const result = await reader.read();
      done = result.done;

      if (result.value) {
        const text = decoder.decode(result.value, { stream: !done });

        if (transform) {
          sseBuffer += text;
          if (sseBuffer.length > MAX_SSE_BUFFER_SIZE) {
            throw new Error('SSE buffer overflow: provider sent data without event boundaries');
          }
          const { events, remaining } = parseSseEvents(sseBuffer);
          sseBuffer = remaining;

          for (const event of events) {
            const transformed = transform(event);
            if (transformed) {
              dest.write(transformed);
              const usage = extractUsageFromSse(transformed);
              if (usage) capturedUsage = usage;
            }
          }
        } else {
          dest.write(text);
          passthroughBuffer += text;
          if (passthroughBuffer.length > MAX_SSE_BUFFER_SIZE) {
            throw new Error('SSE buffer overflow: provider sent data without event boundaries');
          }
          const { events: ptEvents, remaining } = parseSseEvents(passthroughBuffer);
          passthroughBuffer = remaining;
          for (const ev of ptEvents) {
            try {
              const obj = JSON.parse(ev);
              const fromUsage = parseUsageObject(obj.usage);
              if (fromUsage) {
                capturedUsage = fromUsage;
              } else {
                const fromResponse = parseUsageObject(obj.response?.usage);
                if (fromResponse) capturedUsage = fromResponse;
              }
            } catch {
              /* ignore non-JSON events */
            }
          }
        }
      }
    }

    // Flush any remaining passthrough buffer content for usage extraction.
    // The final SSE chunk (containing usage) may not end with \n\n,
    // leaving it unparsed in passthroughBuffer.
    if (!transform && passthroughBuffer.trim()) {
      const payload = passthroughBuffer
        .split('\n')
        .map((line) => (line.startsWith('data: ') ? line.slice(6) : line))
        .join('\n')
        .trim();
      if (payload && payload !== '[DONE]') {
        try {
          const obj = JSON.parse(payload);
          const fromUsage = parseUsageObject(obj.usage);
          if (fromUsage) {
            capturedUsage = fromUsage;
          } else {
            const fromResponse = parseUsageObject(obj.response?.usage);
            if (fromResponse) capturedUsage = fromResponse;
          }
        } catch {
          /* ignore non-JSON remaining content */
        }
      }
    }

    // Flush any remaining buffer content through the transform
    if (transform && sseBuffer.trim()) {
      const payload = sseBuffer
        .split('\n')
        .map((line) => (line.startsWith('data: ') ? line.slice(6) : line))
        .join('\n')
        .trim();
      if (payload && payload !== '[DONE]') {
        const transformed = transform(payload);
        if (transformed) {
          dest.write(transformed);
          const usage = extractUsageFromSse(transformed);
          if (usage) capturedUsage = usage;
        }
      }
    }

    // Stream tail. Anthropic Messages clients self-terminate after
    // `message_stop` (emitted via `finalize`); OpenAI-compatible clients
    // expect `data: [DONE]`. The presence of `finalize` signals the
    // protocol-specific terminator was already written, so we skip the
    // OpenAI sentinel — keeping the wire format clean for SDKs that may
    // refuse to parse trailing unknown payloads.
    // Guard tail writes with `!dest.writableEnded` so a client disconnect
    // mid-stream doesn't trigger ERR_STREAM_WRITE_AFTER_END.
    if (transform && !dest.writableEnded) {
      if (finalize) {
        const trailing = finalize();
        if (trailing && !dest.writableEnded) {
          dest.write(trailing);
          const usage = extractUsageFromSse(trailing);
          if (usage) capturedUsage = usage;
        }
      } else if (!dest.writableEnded) {
        dest.write('data: [DONE]\n\n');
      }
    }
  } finally {
    reader.releaseLock();
    if (!dest.writableEnded) dest.end();
  }

  return capturedUsage;
}
