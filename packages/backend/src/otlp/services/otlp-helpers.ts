import { OtlpKeyValue, OtlpAnyValue } from '../interfaces';

export type AttributeMap = Record<string, string | number | boolean>;

export function extractAttributes(attrs?: OtlpKeyValue[]): AttributeMap {
  const result: AttributeMap = {};
  if (!attrs) return result;
  for (const kv of attrs) {
    const val = resolveAnyValue(kv.value);
    if (val !== undefined) result[kv.key] = val;
  }
  return result;
}

function resolveAnyValue(v: OtlpAnyValue): string | number | boolean | undefined {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.intValue !== undefined) return Number(v.intValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.boolValue !== undefined) return v.boolValue;
  return undefined;
}

/** Converts OTLP nanosecond timestamp to PostgreSQL-compatible datetime string ("YYYY-MM-DD HH:mm:ss.SSS") */
export function nanoToDatetime(nanoStr: string | number): string {
  const nano = BigInt(nanoStr);
  const ms = Number(nano / 1_000_000n);
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
}

export function spanDurationMs(startNano: string, endNano: string): number {
  return Number((BigInt(endNano) - BigInt(startNano)) / 1_000_000n);
}

export function toHexString(input: string | Uint8Array | undefined): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  return Buffer.from(input).toString('hex');
}

export function spanStatusToString(code: number | undefined): string {
  if (code === 2) return 'error';
  return 'ok';
}

export function severityNumberToString(num: number | undefined): string {
  if (!num || num === 0) return 'unspecified';
  if (num <= 4) return 'trace';
  if (num <= 8) return 'debug';
  if (num <= 12) return 'info';
  if (num <= 16) return 'warn';
  if (num <= 20) return 'error';
  return 'fatal';
}

export function getNumericValue(point: { asInt?: string | number; asDouble?: number }): number {
  if (point.asDouble !== undefined) return point.asDouble;
  if (point.asInt !== undefined) return Number(point.asInt);
  return 0;
}

export function attrString(attrs: AttributeMap, key: string): string | null {
  const val = attrs[key];
  return typeof val === 'string' ? val : null;
}

export function attrNumber(attrs: AttributeMap, key: string): number | null {
  const val = attrs[key];
  return typeof val === 'number' ? val : null;
}
