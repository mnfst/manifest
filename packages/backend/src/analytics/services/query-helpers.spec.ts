import { computeTrend, downsample, formatPgTimestamp, addTenantFilter } from './query-helpers';
import { SelectQueryBuilder, Brackets } from 'typeorm';

describe('computeTrend', () => {
  it('returns positive trend when current exceeds previous', () => {
    expect(computeTrend(150, 100)).toBe(50);
  });

  it('returns negative trend when current is less than previous', () => {
    expect(computeTrend(80, 100)).toBe(-20);
  });

  it('returns zero when both current and previous are equal', () => {
    expect(computeTrend(100, 100)).toBe(0);
  });

  it('returns zero when previous is zero (avoid division by zero)', () => {
    expect(computeTrend(100, 0)).toBe(0);
    expect(computeTrend(0, 0)).toBe(0);
  });

  it('rounds the result', () => {
    // (200 - 300) / 300 * 100 = -33.333...
    expect(computeTrend(200, 300)).toBe(-33);
  });

  it('handles 100% increase', () => {
    expect(computeTrend(200, 100)).toBe(100);
  });

  it('handles 100% decrease', () => {
    expect(computeTrend(0, 100)).toBe(-100);
  });
});

describe('downsample', () => {
  it('returns input unchanged when length <= target', () => {
    const data = [10, 20, 30];
    expect(downsample(data, 5)).toEqual([10, 20, 30]);
    expect(downsample(data, 3)).toEqual([10, 20, 30]);
  });

  it('reduces data to target length by summing buckets', () => {
    const data = [1, 2, 3, 4, 5, 6];
    const result = downsample(data, 3);
    expect(result).toHaveLength(3);
    // bucket 0: [1,2] = 3, bucket 1: [3,4] = 7, bucket 2: [5,6] = 11
    expect(result).toEqual([3, 7, 11]);
  });

  it('handles single target bucket', () => {
    const data = [1, 2, 3, 4];
    const result = downsample(data, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(10);
  });

  it('handles empty input', () => {
    expect(downsample([], 5)).toEqual([]);
  });

  it('handles uneven bucket sizes', () => {
    const data = [1, 2, 3, 4, 5];
    const result = downsample(data, 2);
    expect(result).toHaveLength(2);
    // Two buckets from 5 elements
    const sum = result[0]! + result[1]!;
    expect(sum).toBe(15);
  });
});

describe('formatPgTimestamp', () => {
  it('formats a Date as a PG-compatible timestamp string', () => {
    const d = new Date(2026, 1, 16, 10, 5, 3, 42);
    const result = formatPgTimestamp(d);
    expect(result).toBe('2026-02-16T10:05:03.042');
  });

  it('zero-pads single-digit months, days, hours, minutes, seconds', () => {
    const d = new Date(2026, 0, 2, 3, 4, 5, 7);
    const result = formatPgTimestamp(d);
    expect(result).toBe('2026-01-02T03:04:05.007');
  });

  it('handles midnight (all-zero time components)', () => {
    const d = new Date(2026, 5, 15, 0, 0, 0, 0);
    const result = formatPgTimestamp(d);
    expect(result).toBe('2026-06-15T00:00:00.000');
  });

  it('handles end-of-day timestamp', () => {
    const d = new Date(2026, 11, 31, 23, 59, 59, 999);
    const result = formatPgTimestamp(d);
    expect(result).toBe('2026-12-31T23:59:59.999');
  });
});

describe('addTenantFilter', () => {
  function makeMockQb() {
    const mockAndWhere = jest.fn();
    const qb = {
      andWhere: mockAndWhere.mockImplementation(() => qb),
      where: jest.fn().mockImplementation(() => qb),
      orWhere: jest.fn().mockImplementation(() => qb),
    };
    return { qb: qb as unknown as SelectQueryBuilder<never>, mockAndWhere };
  }

  it('adds tenant subquery filter with userId parameter', () => {
    const { qb, mockAndWhere } = makeMockQb();
    addTenantFilter(qb, 'user-123');

    expect(mockAndWhere).toHaveBeenCalledTimes(1);
    const firstCall = mockAndWhere.mock.calls[0];
    expect(firstCall[0]).toBeInstanceOf(Brackets);
  });

  it('adds agent_name filter when agentName is provided', () => {
    const { qb, mockAndWhere } = makeMockQb();
    addTenantFilter(qb, 'user-123', 'my-agent');

    expect(mockAndWhere).toHaveBeenCalledTimes(2);
    const secondCall = mockAndWhere.mock.calls[1];
    expect(secondCall[0]).toBe('at.agent_name = :agentName');
    expect(secondCall[1]).toEqual({ agentName: 'my-agent' });
  });

  it('does not add agent_name filter when agentName is undefined', () => {
    const { qb, mockAndWhere } = makeMockQb();
    addTenantFilter(qb, 'user-123');

    expect(mockAndWhere).toHaveBeenCalledTimes(1);
  });

  it('returns the query builder for chaining', () => {
    const { qb } = makeMockQb();
    const result = addTenantFilter(qb, 'user-123');
    expect(result).toBe(qb);
  });
});
