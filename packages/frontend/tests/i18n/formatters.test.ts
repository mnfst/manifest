import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatList,
  formatNumber,
  formatRelativeTime,
  initializeI18n,
  setLocale,
} from '../../src/i18n/index.js';
import { ensureLocalStorage } from './storage.js';

describe('locale-aware formatters', () => {
  beforeEach(async () => {
    ensureLocalStorage().clear();
    await initializeI18n({ storage: null, languages: ['en-US'] });
  });

  it('formats numbers using the active locale', async () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');

    await setLocale('ru');
    expect(formatNumber(1234.5)).toMatch(/^1[\u00a0\u202f]234,5$/);
  });

  it('formats dates and date-times using explicit locale-independent options', async () => {
    const timestamp = new Date('2024-01-15T09:22:41Z');
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    };
    const dateTimeOptions: Intl.DateTimeFormatOptions = {
      ...dateOptions,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };

    expect(formatDate(timestamp, dateOptions)).toBe('01/15/2024');
    expect(formatDateTime(timestamp, dateTimeOptions)).toMatch(/^01\/15\/2024, 09:22$/);

    await setLocale('ru');
    expect(formatDate(timestamp, dateOptions)).toBe('15.01.2024');
    expect(formatDateTime(timestamp, dateTimeOptions)).toMatch(/^15\.01\.2024, 09:22$/);
  });

  it('formats relative time and lists naturally in each locale', async () => {
    expect(formatRelativeTime(-1, 'day')).toBe('yesterday');
    expect(formatList(['A', 'B', 'C'])).toBe('A, B, and C');

    await setLocale('ru');
    expect(formatRelativeTime(-1, 'day')).toBe('вчера');
    expect(formatList(['A', 'B', 'C'])).toBe('A, B и C');
  });
});
