import { describe, it, expect, vi } from 'vitest';
import {
  createBaseAxes,
  rangeToSeconds,
  formatAxisTimestamp,
} from '../../src/services/chart-utils';

vi.mock('../../src/services/theme.js', () => ({
  getHslA: (cssVar: string, alpha: number) => `hsla(var(${cssVar}), ${alpha})`,
}));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function localHHMM(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function localMonDay(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

describe('createBaseAxes', () => {
  it('returns array of 2 axes', () => {
    const axes = createBaseAxes('#aaa', '#eee');
    expect(axes).toHaveLength(2);
  });

  it('x-axis has correct stroke and grid', () => {
    const axes = createBaseAxes('#aaa', '#eee');
    expect(axes[0].stroke).toBe('#aaa');
    expect(axes[0].grid?.stroke).toBe('#eee');
  });

  it('y-axis has ticks hidden', () => {
    const axes = createBaseAxes('#aaa', '#eee');
    expect(axes[1].ticks?.show).toBe(false);
  });

  it('x-axis values formatter uses range when provided', () => {
    const axes = createBaseAxes('#aaa', '#eee', '24h');
    const mockU = { scales: { x: {} } } as any;
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe(localHHMM(epoch));
  });

  it('x-axis values formatter calculates span from u.scales when no range', () => {
    const axes = createBaseAxes('#aaa', '#eee');
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const mockU = { scales: { x: { min: epoch - 3600, max: epoch } } } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe(localHHMM(epoch));
  });
});

describe('formatAxisTimestamp edge cases', () => {
  it('shows time for 24h range', () => {
    const epoch = Date.UTC(2024, 5, 15, 0, 0) / 1000;
    const result = formatAxisTimestamp(epoch, '24h');
    expect(result).toBe(localHHMM(epoch));
  });

  it('shows just date for 7d range', () => {
    const epoch = Date.UTC(2024, 5, 15, 14, 30) / 1000;
    const result = formatAxisTimestamp(epoch, '7d');
    expect(result).toBe(localMonDay(epoch));
  });

  it('shows just date for 30d range', () => {
    const epoch = Date.UTC(2024, 11, 25, 8, 0) / 1000;
    const result = formatAxisTimestamp(epoch, '30d');
    expect(result).toBe(localMonDay(epoch));
  });
});

describe('rangeToSeconds edge cases', () => {
  it('returns 86400 for empty string', () => {
    expect(rangeToSeconds('')).toBe(86400);
  });
});

// Import additional functions for testing
import { parseTimestamps } from '../../src/services/chart-utils';

describe('parseTimestamps', () => {
  it('parses hour-based timestamps', () => {
    const data = [{ hour: '2024-01-15 10:00' }, { hour: '2024-01-15 11:00' }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe('number');
    expect(result[0]).toBeGreaterThan(0);
  });

  it('parses date-based timestamps', () => {
    const data = [{ date: '2024-01-15' }, { date: '2024-01-16' }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(2);
    expect(result[1]).toBeGreaterThan(result[0]);
  });

  it('returns empty array for empty input', () => {
    const result = parseTimestamps([]);
    expect(result).toHaveLength(0);
  });
});
