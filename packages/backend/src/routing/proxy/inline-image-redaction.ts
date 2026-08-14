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

  const mimeType = match[1].toLowerCase();
  const base64Chars = value.length - match[0].length;
  const decodedBytes = estimateDecodedBase64Bytes(value.slice(match[0].length));
  return {
    value: `[inline image: ${mimeType}, ${decodedBytes} bytes, ${base64Chars} base64 chars]`,
    changed: true,
  };
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
