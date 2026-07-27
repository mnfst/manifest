import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';
import type { StoredRequestRecording } from '../../entities/request-recording.entity';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function encodeRequestRecording(payload: StoredRequestRecording): Promise<Buffer> {
  return gzipAsync(Buffer.from(JSON.stringify(payload), 'utf8'));
}

export async function decodeRequestRecording(body: Buffer): Promise<StoredRequestRecording> {
  const payload = JSON.parse((await gunzipAsync(body)).toString('utf8')) as StoredRequestRecording;
  if (
    payload.version !== 1 ||
    !payload.request_body ||
    typeof payload.request_body !== 'object' ||
    !payload.response_body
  ) {
    throw new Error('Invalid request recording object');
  }
  return payload;
}
