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

export type BudgetTone = 'ok' | 'warn' | 'over' | 'none';

export interface BudgetState {
  tone: BudgetTone;
  /** 0..1 of the budget consumed, capped at 1. */
  ratio: number;
  /** Positive when under budget, negative when over. */
  left: number | null;
}

/** Amber from 80% of the cap, red past it. */
export const BUDGET_WARN_RATIO = 0.8;

export function budgetState(spend: number, budget: number | null | undefined): BudgetState {
  if (budget == null || budget <= 0) return { tone: 'none', ratio: 0, left: null };
  const left = Math.round((budget - spend) * 100) / 100;
  const raw = spend / budget;
  const tone: BudgetTone = raw > 1 ? 'over' : raw >= BUDGET_WARN_RATIO ? 'warn' : 'ok';
  return { tone, ratio: Math.min(1, Math.max(0, raw)), left };
}

/** "$13.80 left", "$8.40 over", or null without a budget. */
export function budgetLabel(spend: number, budget: number | null | undefined): string | null {
  const state = budgetState(spend, budget);
  if (state.left == null) return null;
  const abs = Math.abs(state.left).toFixed(2);
  return state.left < 0 ? `$${abs} over` : `$${abs} left`;
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

/** Largest budget the UI accepts, so cents rounding can never overflow. */
export const MAX_BUDGET_USD = 1_000_000_000;

/**
 * Parse a budget field: empty → null (no budget), invalid → undefined.
 * Zero is invalid: a $0 budget would read as "over" on every meter while the
 * rest of the UI treats no budget as unlimited, so it has to be one or the other.
 */
export function parseBudgetInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_BUDGET_USD) return undefined;
  const cents = Math.round(n * 100) / 100;
  return Number.isFinite(cents) && cents > 0 ? cents : undefined;
}
