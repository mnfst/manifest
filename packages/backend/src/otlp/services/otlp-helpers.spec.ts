import {
  extractAttributes,
  nanoToDatetime,
  spanDurationMs,
  toHexString,
  spanStatusToString,
  severityNumberToString,
  getNumericValue,
  attrString,
  attrNumber,
  AttributeMap,
} from './otlp-helpers';
import { computeCutoff } from '../../common/utils/sql-dialect';

describe('extractAttributes', () => {
  it('extracts string values', () => {
    const attrs = [{ key: 'service.name', value: { stringValue: 'my-service' } }];
    expect(extractAttributes(attrs)).toEqual({ 'service.name': 'my-service' });
  });

  it('extracts int values', () => {
    const attrs = [{ key: 'count', value: { intValue: 42 } }];
    expect(extractAttributes(attrs)).toEqual({ count: 42 });
  });

  it('extracts int values from string representation', () => {
    const attrs = [{ key: 'count', value: { intValue: '99' } }];
    expect(extractAttributes(attrs)).toEqual({ count: 99 });
  });

  it('extracts double values', () => {
    const attrs = [{ key: 'ratio', value: { doubleValue: 3.14 } }];
    expect(extractAttributes(attrs)).toEqual({ ratio: 3.14 });
  });

  it('extracts boolean values', () => {
    const attrs = [{ key: 'enabled', value: { boolValue: true } }];
    expect(extractAttributes(attrs)).toEqual({ enabled: true });
  });

  it('skips unresolvable values (array, kvlist)', () => {
    const attrs = [
      { key: 'complex', value: { arrayValue: { values: [] } } },
    ];
    expect(extractAttributes(attrs)).toEqual({});
  });

  it('returns empty map for undefined input', () => {
    expect(extractAttributes(undefined)).toEqual({});
  });

  it('returns empty map for empty array', () => {
    expect(extractAttributes([])).toEqual({});
  });

  it('handles multiple attributes', () => {
    const attrs = [
      { key: 'name', value: { stringValue: 'test' } },
      { key: 'count', value: { intValue: 5 } },
      { key: 'active', value: { boolValue: false } },
    ];
    expect(extractAttributes(attrs)).toEqual({
      name: 'test',
      count: 5,
      active: false,
    });
  });
});

describe('nanoToDatetime', () => {
  it('converts nanosecond timestamp to datetime string', () => {
    // 2026-02-16T12:00:00.000Z in nanoseconds
    const nanos = BigInt(new Date('2026-02-16T12:00:00.000Z').getTime()) * 1_000_000n;
    const result = nanoToDatetime(nanos.toString());
    expect(result).toBe('2026-02-16T12:00:00.000Z');
  });

  it('accepts numeric input', () => {
    const ms = new Date('2026-01-01T00:00:00.000Z').getTime();
    const nanos = BigInt(ms) * 1_000_000n;
    const result = nanoToDatetime(Number(nanos));
    expect(result).toContain('2026-01-01');
  });
});

describe('nanoToDatetime format consistency', () => {
  it('outputs strict ISO-8601 format with trailing Z', () => {
    const nanos = BigInt(Date.now()) * 1_000_000n;
    const result = nanoToDatetime(nanos.toString());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('produces timestamps comparable with computeCutoff (write/read parity)', () => {
    const nanos = BigInt(Date.now()) * 1_000_000n;
    const written = nanoToDatetime(nanos.toString());
    const cutoff = computeCutoff('1 hour');
    // Written "now" must be lexicographically >= cutoff (1 hour ago)
    expect(written >= cutoff).toBe(true);
  });

  it('produces timestamps that sort correctly as strings', () => {
    const earlier = BigInt(new Date('2026-02-16T10:00:00Z').getTime()) * 1_000_000n;
    const later = BigInt(new Date('2026-02-16T11:00:00Z').getTime()) * 1_000_000n;
    const a = nanoToDatetime(earlier.toString());
    const b = nanoToDatetime(later.toString());
    expect(a < b).toBe(true);
  });
});

describe('spanDurationMs', () => {
  it('computes duration between two nano timestamps', () => {
    // 1 second = 1_000_000_000 nanoseconds
    const start = '1000000000'; // 1s
    const end =   '2500000000'; // 2.5s
    expect(spanDurationMs(start, end)).toBe(1500);
  });

  it('computes 1 second duration correctly', () => {
    const start = '0';
    const end = '1000000000'; // 1 second in nanoseconds
    expect(spanDurationMs(start, end)).toBe(1000);
  });

  it('returns 0 when start equals end', () => {
    expect(spanDurationMs('1000000000', '1000000000')).toBe(0);
  });
});

describe('toHexString', () => {
  it('returns empty string for undefined', () => {
    expect(toHexString(undefined)).toBe('');
  });

  it('returns string input as-is', () => {
    expect(toHexString('abc123')).toBe('abc123');
  });

  it('converts Uint8Array to hex string', () => {
    const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
    expect(toHexString(bytes)).toBe('abcdef');
  });

  it('converts empty Uint8Array to empty string', () => {
    expect(toHexString(new Uint8Array([]))).toBe('');
  });
});

describe('spanStatusToString', () => {
  it('returns "error" for code 2', () => {
    expect(spanStatusToString(2)).toBe('error');
  });

  it('returns "ok" for code 0', () => {
    expect(spanStatusToString(0)).toBe('ok');
  });

  it('returns "ok" for code 1', () => {
    expect(spanStatusToString(1)).toBe('ok');
  });

  it('returns "ok" for undefined', () => {
    expect(spanStatusToString(undefined)).toBe('ok');
  });
});

describe('severityNumberToString', () => {
  it('returns "unspecified" for 0 or undefined', () => {
    expect(severityNumberToString(0)).toBe('unspecified');
    expect(severityNumberToString(undefined)).toBe('unspecified');
  });

  it('returns "trace" for 1-4', () => {
    expect(severityNumberToString(1)).toBe('trace');
    expect(severityNumberToString(4)).toBe('trace');
  });

  it('returns "debug" for 5-8', () => {
    expect(severityNumberToString(5)).toBe('debug');
    expect(severityNumberToString(8)).toBe('debug');
  });

  it('returns "info" for 9-12', () => {
    expect(severityNumberToString(9)).toBe('info');
    expect(severityNumberToString(12)).toBe('info');
  });

  it('returns "warn" for 13-16', () => {
    expect(severityNumberToString(13)).toBe('warn');
    expect(severityNumberToString(16)).toBe('warn');
  });

  it('returns "error" for 17-20', () => {
    expect(severityNumberToString(17)).toBe('error');
    expect(severityNumberToString(20)).toBe('error');
  });

  it('returns "fatal" for 21+', () => {
    expect(severityNumberToString(21)).toBe('fatal');
    expect(severityNumberToString(24)).toBe('fatal');
  });
});

describe('getNumericValue', () => {
  it('returns asDouble when present', () => {
    expect(getNumericValue({ asDouble: 3.14 })).toBe(3.14);
  });

  it('returns asInt as number when present', () => {
    expect(getNumericValue({ asInt: 42 })).toBe(42);
    expect(getNumericValue({ asInt: '99' })).toBe(99);
  });

  it('prefers asDouble over asInt', () => {
    expect(getNumericValue({ asDouble: 1.5, asInt: 2 })).toBe(1.5);
  });

  it('returns 0 when neither is present', () => {
    expect(getNumericValue({})).toBe(0);
  });
});

describe('attrString', () => {
  it('returns string value for matching key', () => {
    const attrs: AttributeMap = { name: 'test', count: 5 };
    expect(attrString(attrs, 'name')).toBe('test');
  });

  it('returns null for non-string value', () => {
    const attrs: AttributeMap = { count: 5 };
    expect(attrString(attrs, 'count')).toBeNull();
  });

  it('returns null for missing key', () => {
    const attrs: AttributeMap = {};
    expect(attrString(attrs, 'missing')).toBeNull();
  });
});

describe('attrNumber', () => {
  it('returns number value for matching key', () => {
    const attrs: AttributeMap = { count: 42 };
    expect(attrNumber(attrs, 'count')).toBe(42);
  });

  it('returns null for non-number value', () => {
    const attrs: AttributeMap = { name: 'test' };
    expect(attrNumber(attrs, 'name')).toBeNull();
  });

  it('returns null for missing key', () => {
    const attrs: AttributeMap = {};
    expect(attrNumber(attrs, 'missing')).toBeNull();
  });
});
