import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';
import type { StoredAttemptRecording } from '../../routing/proxy/attempt-recording.types';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function encodeRequestRecording(payload: StoredAttemptRecording): Promise<Buffer> {
  return gzipAsync(Buffer.from(JSON.stringify(payload), 'utf8'));
}

export async function decodeRequestRecording(body: Buffer): Promise<StoredAttemptRecording> {
  const payload = JSON.parse((await gunzipAsync(body)).toString('utf8')) as StoredAttemptRecording;
  if (
    payload.version !== 1 ||
    typeof payload.wire_format !== 'string' ||
    !payload.wire_format ||
    !payload.request_body ||
    typeof payload.request_body !== 'object' ||
    !('response_body' in payload)
  ) {
    throw new Error('Invalid request recording object');
  }
  return payload;
}
