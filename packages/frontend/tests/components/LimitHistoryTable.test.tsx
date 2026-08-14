import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import LimitHistoryTable from '../../src/components/LimitHistoryTable';
import type { NotificationLog } from '../../src/services/api/notifications';

const q = (sel: string) => document.querySelector(sel);
const qa = (sel: string) => document.querySelectorAll(sel);

const makeLogs = (overrides?: Partial<NotificationLog>[]): NotificationLog[] =>
  (overrides ?? [{}]).map((o, i) => ({
    id: `log-${i}`,
    sent_at: '2026-03-29 07:45:00',
    actual_value: 60000,
    threshold_value: 50000,
    metric_type: 'tokens' as const,
    period_start: '2026-03-29 00:00:00',
    period_end: '2026-03-30 00:00:00',
    agent_name: 'my-agent',
    ...o,
  }));

describe('LimitHistoryTable', () => {
  it('renders panel with History title', () => {
    render(() => <LimitHistoryTable logs={makeLogs()} loading={false} />);
    expect(q('.panel__title')!.textContent).toBe('History');
  });

  it('renders skeleton rows when loading', () => {
    render(() => <LimitHistoryTable logs={undefined} loading={true} />);
    const skeletons = qa('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no logs', () => {
    render(() => <LimitHistoryTable logs={[]} loading={false} />);
    expect(q('.empty-state__title')!.textContent).toBe('No alerts triggered yet');
  });

  it('renders log rows with formatted values', () => {
    render(() => <LimitHistoryTable logs={makeLogs()} loading={false} />);
    const rows = qa('tbody tr');
    expect(rows.length).toBe(1);
    const cells = rows[0].querySelectorAll('td');
    expect(cells[1].textContent).toContain('60,000 tokens');
    expect(cells[2].textContent).toContain('50,000 tokens');
  });

  it('formats cost values with dollar sign', () => {
    render(() => (
      <LimitHistoryTable
        logs={makeLogs([{ metric_type: 'cost', actual_value: 12.5, threshold_value: 10 }])}
        loading={false}
      />
    ));
    const cells = qa('tbody tr td');
    expect(cells[1].textContent).toContain('$12.50');
    expect(cells[2].textContent).toContain('$10.00');
  });

  it('renders multiple rows in order', () => {
    const logs = makeLogs([
      { actual_value: 100000 },
      { actual_value: 200000 },
    ]);
    render(() => <LimitHistoryTable logs={logs} loading={false} />);
    const rows = qa('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('renders table headers', () => {
    render(() => <LimitHistoryTable logs={makeLogs()} loading={false} />);
    const headers = qa('thead th');
    expect(headers[0].textContent).toBe('Date');
    expect(headers[1].textContent).toBe('Usage');
    expect(headers[2].textContent).toBe('Threshold');
    expect(headers[3].textContent).toBe('Resets at');
  });

  it('normalizes UTC timestamps for local display', () => {
    render(() => (
      <LimitHistoryTable
        logs={makeLogs([{ sent_at: '2026-03-29 12:00:00' }])}
        loading={false}
      />
    ));
    const dateCell = qa('tbody tr td')[0];
    // Should not contain raw "12:00:00" — it should be formatted by toLocaleDateString
    expect(dateCell.textContent).not.toContain('12:00:00');
  });
});
