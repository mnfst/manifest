import type { RecordingResponseBody } from '../../entities/message-recording.entity';
import { filterResponseHeaders } from '../../common/utils/response-header-allowlist';

export const RECORDING_MAX_BYTES = 2 * 1024 * 1024;

export interface CaptureSink {
  overflowed: boolean;
  bytesUsed: number;
  rawSse: string;
  jsonBody: unknown | undefined;
  responseHeaders: Record<string, string>;
  appendRaw(text: string): void;
  setJson(body: unknown): void;
  setHeaders(h: Record<string, string>): void;
  buildResponseBody(): RecordingResponseBody | null;
  getSizeBytes(): number;
}

export function createCaptureSink(limitBytes: number = RECORDING_MAX_BYTES): CaptureSink {
  return {
    overflowed: false,
    bytesUsed: 0,
    rawSse: '',
    jsonBody: undefined,
    responseHeaders: {},
    appendRaw(text: string): void {
      if (this.overflowed) return;
      const addBytes = Buffer.byteLength(text, 'utf8');
      if (this.bytesUsed + addBytes > limitBytes) {
        this.overflowed = true;
        this.rawSse = '';
        this.jsonBody = undefined;
        return;
      }
      this.bytesUsed += addBytes;
      this.rawSse += text;
    },
    setJson(body: unknown): void {
      if (this.overflowed) return;
      const serialized = safeStringify(body);
      if (serialized === '') return;
      const size = Buffer.byteLength(serialized, 'utf8');
      // Don't accept a JSON body if we've already buffered streamed bytes —
      // mixing the two breaks `buildResponseBody` (it can only emit one of
      // the two shapes) and corrupts the byte accounting. Drop the JSON
      // capture rather than silently overwrite the SSE buffer.
      if (this.rawSse !== '') {
        this.overflowed = true;
        this.jsonBody = undefined;
        return;
      }
      if (size > limitBytes) {
        this.overflowed = true;
        this.jsonBody = undefined;
        return;
      }
      this.bytesUsed = size;
      this.jsonBody = body;
    },
    setHeaders(h: Record<string, string>): void {
      this.responseHeaders = h;
    },
    buildResponseBody(): RecordingResponseBody | null {
      if (this.overflowed) return null;
      if (this.jsonBody !== undefined) {
        return { type: 'json', body: this.jsonBody };
      }
      if (this.rawSse) {
        return { type: 'stream', raw_sse: this.rawSse };
      }
      return null;
    },
    getSizeBytes(): number {
      return this.bytesUsed;
    },
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Allowlist response headers before persisting them in `message_recordings`.
 * The proxy's previous denylist was too narrow — provider/CDN echoes of
 * `x-api-key`, custom `www-authenticate`, etc. would survive. Switching to
 * the shared allowlist closes that gap and matches what we already expose
 * for benchmark history.
 */
export function sanitizeResponseHeaders(headers: Headers): Record<string, string> {
  return filterResponseHeaders(headers);
}
