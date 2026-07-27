import type {
  RecordingResponseBody,
  StoredRequestRecording,
} from '../../entities/request-recording.entity';

export interface RequestRecordingCapture {
  appendRaw(text: string): void;
  setJson(body: unknown): void;
  buildResponseBody(): RecordingResponseBody | null;
  buildRecording(): StoredRequestRecording | null;
}

export function createRequestRecordingCapture(
  requestBody: Record<string, unknown> = {},
): RequestRecordingCapture {
  let rawSse = '';
  let jsonBody: unknown;

  const buildResponseBody = (): RecordingResponseBody | null => {
    if (jsonBody !== undefined) return { type: 'json', body: jsonBody };
    if (rawSse) return { type: 'stream', raw_sse: rawSse };
    return null;
  };

  return {
    appendRaw(text: string): void {
      rawSse += text;
    },
    setJson(body: unknown): void {
      jsonBody = body;
      rawSse = '';
    },
    buildResponseBody,
    buildRecording(): StoredRequestRecording | null {
      const responseBody = buildResponseBody();
      return responseBody
        ? {
            version: 1,
            request_body: requestBody,
            response_body: responseBody,
          }
        : null;
    },
  };
}
