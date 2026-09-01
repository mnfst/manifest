import { customProviderColor } from './formatters.js';

/** "Maya Okonkwo" → "MO", "claude-code" → "C". */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/** Deterministic avatar colour from the shared palette. */
export function avatarColor(name: string): string {
  return customProviderColor(name);
}

/** "$1,204.80" with thousands separators for headline figures. */
export function formatMoney(value: number): string {
  return `$${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "August 2026" for the current month. */
export function currentMonthLabel(date = new Date()): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * A cell that starts like a spreadsheet formula (`=`, `+`, `-`, `@`, tab, CR)
 * is prefixed with an apostrophe so a hostile name cannot execute on open.
 */
export function csvEscape(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

/** Trigger a browser download of `content`. No-op outside a browser. */
export function downloadTextFile(filename: string, content: string, type = 'text/csv'): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
