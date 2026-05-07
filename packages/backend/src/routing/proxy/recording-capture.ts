import type { RecordingResponseBody } from '../../entities/message-recording.entity';

export const RECORDING_MAX_BYTES = 2 * 1024 * 1024;

const SENSITIVE_RESPONSE_HEADERS = new Set<string>([
  'set-cookie',
  'authorization',
  'proxy-authorization',
]);

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
      if (size > limitBytes) {
        this.overflowed = true;
        this.jsonBody = undefined;
        return;
      }
      // Stream and non-stream paths are mutually exclusive in proxy-response-handler,
      // so the JSON body fully replaces any prior state for byte accounting.
      this.bytesUsed = size;
      this.rawSse = '';
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

export function sanitizeResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (SENSITIVE_RESPONSE_HEADERS.has(lower)) return;
    out[lower] = value;
  });
  return out;
}
