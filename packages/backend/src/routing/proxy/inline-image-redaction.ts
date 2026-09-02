const INLINE_IMAGE_DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,/i;

export function redactInlineImageDataUrls<T>(value: T): T {
  return redactValue(value).value as T;
}

interface RedactResult {
  value: unknown;
  changed: boolean;
}

function redactValue(value: unknown): RedactResult {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return redactArray(value);
  if (!isPlainRecord(value)) return { value, changed: false };

  const inline = redactInlineBase64Record(value);
  if (inline) return inline;

  const out: Record<string, unknown> = {};
  let changed = false;
  for (const [key, nested] of Object.entries(value)) {
    const result = redactValue(nested);
    out[key] = result.value;
    changed ||= result.changed;
  }
  return changed ? { value: out, changed } : { value, changed: false };
}

function redactArray(values: unknown[]): RedactResult {
  let changed = false;
  const out = values.map((item) => {
    const result = redactValue(item);
    changed ||= result.changed;
    return result.value;
  });
  return changed ? { value: out, changed } : { value: values, changed: false };
}

function redactString(value: string): RedactResult {
  const match = INLINE_IMAGE_DATA_URL_RE.exec(value);
  if (!match) return { value, changed: false };
  return { value: describeInlineImage(match[1], value.slice(match[0].length)), changed: true };
}

// Provider-native image blocks carry the bytes in a `data` field next to the
// mime type instead of inside a data URL: Anthropic `source: { type: 'base64',
// media_type, data }` and Google `inline_data: { mime_type, data }` (also
// camel-cased as `inlineData` / `mimeType`). Match on the shape, not the parent
// key, so both wire formats and their casing variants are covered.
const INLINE_MIME_KEYS = ['media_type', 'mime_type', 'mimeType'] as const;

function redactInlineBase64Record(value: Record<string, unknown>): RedactResult | null {
  const data = value['data'];
  if (typeof data !== 'string' || data.length === 0) return null;
  const mimeKey = INLINE_MIME_KEYS.find((key) => typeof value[key] === 'string');
  if (!mimeKey) return null;
  const mimeType = value[mimeKey] as string;
  if (!/^image\//i.test(mimeType)) return null;
  return { value: { ...value, data: describeInlineImage(mimeType, data) }, changed: true };
}

function describeInlineImage(mimeType: string, base64: string): string {
  const decodedBytes = estimateDecodedBase64Bytes(base64);
  return `[inline image: ${mimeType.toLowerCase()}, ${decodedBytes} bytes, ${base64.length} base64 chars]`;
}

function estimateDecodedBase64Bytes(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}
