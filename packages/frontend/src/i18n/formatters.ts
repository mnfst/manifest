import { localeTag } from './locale.js';

type DateInput = Date | number | string;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeTag(), options).format(value);
}

export function formatDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeTag(), options ?? { dateStyle: 'medium' }).format(
    toDate(value),
  );
}

export function formatDateTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(
    localeTag(),
    options ?? { dateStyle: 'medium', timeStyle: 'short' },
  ).format(toDate(value));
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  return new Intl.RelativeTimeFormat(localeTag(), { numeric: 'auto', ...options }).format(
    value,
    unit,
  );
}
