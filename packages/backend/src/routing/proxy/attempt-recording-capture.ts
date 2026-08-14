import type { RecordingResponseBody, StoredAttemptRecording } from './attempt-recording.types';

export interface AttemptRecordingCapture {
  appendRaw(text: string): void;
  setJson(body: unknown): void;
  setRaw(text: string): void;
  buildResponseBody(): RecordingResponseBody | null;
  buildRecording(): StoredAttemptRecording;
}

export function recordingResponseFromText(raw: string): RecordingResponseBody {
  try {
    return { type: 'json', body: JSON.parse(raw) as unknown };
  } catch {
    return { type: 'json', body: raw };
  }
}

export function createAttemptRecordingCapture(
  requestBody: Record<string, unknown>,
  wireFormat: string,
): AttemptRecordingCapture {
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
    setRaw(text: string): void {
      jsonBody = undefined;
      rawSse = text;
    },
    buildResponseBody,
    buildRecording(): StoredAttemptRecording {
      return {
        version: 1,
        wire_format: wireFormat,
        request_body: requestBody,
        response_body: buildResponseBody(),
      };
    },
  };
}
