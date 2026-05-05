import {
  computeTrend,
  downsample,
  formatTimestamp,
  addTenantFilter,
  selectMessageRowColumns,
  MESSAGE_ROW_SELECT_ALIASES,
} from './query-helpers';
import { SelectQueryBuilder } from 'typeorm';

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

  it('returns zero when previous is near-zero (floating-point edge case)', () => {
    expect(computeTrend(0, 1e-9)).toBe(0);
    expect(computeTrend(0.001, 1e-9)).toBe(0);
    expect(computeTrend(1e-9, 1e-9)).toBe(0);
  });

  it('returns zero when both values are near-zero', () => {
    expect(computeTrend(1e-8, 1e-7)).toBe(0);
    expect(computeTrend(0, 0.0000001)).toBe(0);
  });

  it('clamps extreme positive trends to 999', () => {
    expect(computeTrend(10000, 1)).toBe(999);
  });

  it('clamps extreme negative trends to -999', () => {
    expect(computeTrend(0, 100)).toBe(-100);
  });

  it('rounds the result', () => {
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
    const sum = result[0]! + result[1]!;
    expect(sum).toBe(15);
  });
});

describe('formatTimestamp', () => {
  it('formats a Date as a PG-compatible timestamp string', () => {
    const d = new Date(2026, 1, 16, 10, 5, 3, 42);
    const result = formatTimestamp(d);
    expect(result).toBe('2026-02-16T10:05:03.042');
  });

  it('zero-pads single-digit months, days, hours, minutes, seconds', () => {
    const d = new Date(2026, 0, 2, 3, 4, 5, 7);
    const result = formatTimestamp(d);
    expect(result).toBe('2026-01-02T03:04:05.007');
  });

  it('handles midnight (all-zero time components)', () => {
    const d = new Date(2026, 5, 15, 0, 0, 0, 0);
    const result = formatTimestamp(d);
    expect(result).toBe('2026-06-15T00:00:00.000');
  });

  it('handles end-of-day timestamp', () => {
    const d = new Date(2026, 11, 31, 23, 59, 59, 999);
    const result = formatTimestamp(d);
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

  it('filters by user_id when no tenantId is provided', () => {
    const { qb, mockAndWhere } = makeMockQb();
    addTenantFilter(qb, 'user-123');

    expect(mockAndWhere).toHaveBeenCalledTimes(1);
    expect(mockAndWhere).toHaveBeenCalledWith('at.user_id = :userId', { userId: 'user-123' });
  });

  it('filters by tenant_id when tenantId is provided', () => {
    const { qb, mockAndWhere } = makeMockQb();
    addTenantFilter(qb, 'user-123', undefined, 'tenant-456');

    expect(mockAndWhere).toHaveBeenCalledTimes(1);
    expect(mockAndWhere).toHaveBeenCalledWith('at.tenant_id = :tenantId', {
      tenantId: 'tenant-456',
    });
  });

  it('resolves agentName to the live agent_id via subquery so soft-deleted agents do not leak', () => {
    const { qb, mockAndWhere } = makeMockQb();
    addTenantFilter(qb, 'user-123', 'my-agent');

    expect(mockAndWhere).toHaveBeenCalledTimes(2);
    const secondCall = mockAndWhere.mock.calls[1];
    expect(secondCall[0]).toContain('at.agent_id = (');
    expect(secondCall[0]).toContain('FROM agents');
    expect(secondCall[0]).toContain('deleted_at IS NULL');
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

  it('accepts both agentName and tenantId together', () => {
    const { qb, mockAndWhere } = makeMockQb();
    addTenantFilter(qb, 'user-123', 'my-agent', 'tenant-456');

    expect(mockAndWhere).toHaveBeenCalledTimes(2);
  });
});

describe('selectMessageRowColumns', () => {
  function makeMockQb() {
    const selectCalls: Array<[string, string]> = [];
    const addSelectCalls: Array<[string, string]> = [];
    const qb = {
      select: jest.fn().mockImplementation((expr: string, alias: string) => {
        selectCalls.push([expr, alias]);
        return qb;
      }),
      addSelect: jest.fn().mockImplementation((expr: string, alias: string) => {
        addSelectCalls.push([expr, alias]);
        return qb;
      }),
    };
    return { qb: qb as unknown as SelectQueryBuilder<never>, selectCalls, addSelectCalls };
  }

  it('projects exactly the columns declared in MESSAGE_ROW_SELECT_ALIASES', () => {
    const { qb, selectCalls, addSelectCalls } = makeMockQb();
    selectMessageRowColumns(qb, 'CAST(at.cost_usd AS FLOAT)');

    expect(selectCalls).toHaveLength(1);
    expect(addSelectCalls).toHaveLength(MESSAGE_ROW_SELECT_ALIASES.length - 1);

    const emittedAliases = [selectCalls[0]![1], ...addSelectCalls.map(([, alias]) => alias)];
    expect(emittedAliases).toEqual([...MESSAGE_ROW_SELECT_ALIASES]);
  });

  it('uses the caller-supplied cost expression verbatim', () => {
    const { qb, addSelectCalls } = makeMockQb();
    const costExpr = 'CAST(CASE WHEN at.cost_usd >= 0 THEN at.cost_usd ELSE NULL END AS FLOAT)';
    selectMessageRowColumns(qb, costExpr);

    const costCall = addSelectCalls.find(([, alias]) => alias === 'cost');
    expect(costCall).toEqual([costExpr, 'cost']);
  });

  it('computes total_tokens from input_tokens + output_tokens', () => {
    const { qb, addSelectCalls } = makeMockQb();
    selectMessageRowColumns(qb, 'cost');

    const totalCall = addSelectCalls.find(([, alias]) => alias === 'total_tokens');
    expect(totalCall).toEqual(['at.input_tokens + at.output_tokens', 'total_tokens']);
  });

  it('aliases display_name from at.model', () => {
    const { qb, addSelectCalls } = makeMockQb();
    selectMessageRowColumns(qb, 'cost');

    const displayNameCall = addSelectCalls.find(([, alias]) => alias === 'display_name');
    expect(displayNameCall).toEqual(['at.model', 'display_name']);
  });

  it('projects specificity_category so the frontend badge can render it', () => {
    const { qb, addSelectCalls } = makeMockQb();
    selectMessageRowColumns(qb, 'cost');

    const specCall = addSelectCalls.find(([, alias]) => alias === 'specificity_category');
    expect(specCall).toEqual(['at.specificity_category', 'specificity_category']);
  });

  it('returns the query builder for chaining', () => {
    const { qb } = makeMockQb();
    const result = selectMessageRowColumns(qb, 'cost');
    expect(result).toBe(qb);
  });
});
