import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  REQUEST_HEADERS_STORAGE_KEY,
  activeHeaderCount,
  findDisplayName,
  findWinners,
  loadStoredHeaders,
  persistHeaders,
} from '../../src/services/benchmark-helpers';
import type { BenchmarkColumn } from '../../src/services/benchmark-store';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadStoredHeaders', () => {
  it('returns [] when nothing is stored', () => {
    expect(loadStoredHeaders()).toEqual([]);
  });

  it('returns [] when the stored value is not valid JSON', () => {
    localStorage.setItem(REQUEST_HEADERS_STORAGE_KEY, '{not json');
    expect(loadStoredHeaders()).toEqual([]);
  });

  it('returns [] when the stored value is not an array', () => {
    localStorage.setItem(REQUEST_HEADERS_STORAGE_KEY, JSON.stringify({ fake: true }));
    expect(loadStoredHeaders()).toEqual([]);
  });

  it('keeps only entries with the expected shape and caps at 20', () => {
    const valid = Array.from({ length: 25 }, (_, i) => ({ id: `h${i}`, key: `K${i}`, value: 'v' }));
    const junk = [{ id: 'bad' }, { key: 'x', value: 'y' }, 42];
    localStorage.setItem(REQUEST_HEADERS_STORAGE_KEY, JSON.stringify([...valid, ...junk]));
    const out = loadStoredHeaders();
    expect(out).toHaveLength(20);
    expect(out.every((e) => typeof e.id === 'string')).toBe(true);
  });
});

describe('persistHeaders', () => {
  it('stringifies and writes to localStorage', () => {
    persistHeaders([{ id: 'h1', key: 'X-Title', value: 'Foo' }]);
    expect(localStorage.getItem(REQUEST_HEADERS_STORAGE_KEY)).toBe(
      JSON.stringify([{ id: 'h1', key: 'X-Title', value: 'Foo' }]),
    );
  });

  it('swallows quota / private-mode errors without throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => persistHeaders([{ id: 'h1', key: 'X', value: 'Y' }])).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});

describe('activeHeaderCount', () => {
  it('counts only non-empty, non-blocked rows', () => {
    const n = activeHeaderCount([
      { id: '1', key: 'X-Title', value: 'Foo' },
      { id: '2', key: 'Authorization', value: 'Bearer' },
      { id: '3', key: '', value: 'orphan' },
      { id: '4', key: 'X-Empty', value: '' },
      { id: '5', key: 'HTTP-Referer', value: 'https://x' },
    ]);
    expect(n).toBe(2);
  });
});

describe('findDisplayName', () => {
  it('returns the display_name when present', () => {
    expect(findDisplayName([{ model_name: 'openai/gpt-4o', display_name: 'GPT-4o' }], 'openai/gpt-4o')).toBe('GPT-4o');
  });

  it('falls back to the model id when no match or no display_name', () => {
    expect(findDisplayName([], 'openai/gpt-4o')).toBe('openai/gpt-4o');
    expect(findDisplayName([{ model_name: 'openai/gpt-4o' }], 'openai/gpt-4o')).toBe('openai/gpt-4o');
  });
});

function col(id: string, cost: number | null, durationMs: number): BenchmarkColumn {
  return {
    id,
    model: 'm',
    provider: 'p',
    authType: 'api_key',
    displayName: id,
    status: 'success',
    metrics: { cost, inputTokens: 1, outputTokens: 1, durationMs },
  };
}

describe('findWinners', () => {
  it('returns {} when there are fewer than 2 successful columns', () => {
    expect(findWinners([col('a', 0.001, 100)])).toEqual({});
  });

  it('ignores columns that are still loading or errored', () => {
    const cols: BenchmarkColumn[] = [
      col('a', 0.001, 100),
      { id: 'b', model: 'm', provider: 'p', authType: 'api_key', displayName: 'b', status: 'loading' },
    ];
    expect(findWinners(cols)).toEqual({});
  });

  it('picks the cheapest cost and the fastest duration (possibly different columns)', () => {
    const out = findWinners([col('a', 0.002, 100), col('b', 0.001, 300)]);
    expect(out).toEqual({ cheapestId: 'b', fastestId: 'a' });
  });

  it('skips columns whose cost is null when picking the cheapest', () => {
    const out = findWinners([col('a', null, 100), col('b', 0.005, 80)]);
    expect(out.cheapestId).toBe('b');
    expect(out.fastestId).toBe('b');
  });
});
