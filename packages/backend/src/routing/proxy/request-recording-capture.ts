import type { RecordingResponseBody } from '../../entities/request-recording.entity';

export interface RequestRecordingCapture {
  appendRaw(text: string): void;
  setJson(body: unknown): void;
  buildResponseBody(): RecordingResponseBody | null;
}

export function createRequestRecordingCapture(): RequestRecordingCapture {
  let rawSse = '';
  let jsonBody: unknown;

  return {
    appendRaw(text: string): void {
      rawSse += text;
    },
    setJson(body: unknown): void {
      jsonBody = body;
      rawSse = '';
    },
    buildResponseBody(): RecordingResponseBody | null {
      if (jsonBody !== undefined) return { type: 'json', body: jsonBody };
      if (rawSse) return { type: 'stream', raw_sse: rawSse };
      return null;
    },
  };
}
