import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import LimitRuleTable from '../../src/components/LimitRuleTable';
import type { NotificationRule } from '../../src/services/api';

vi.mock('../../src/components/AlertIcon.js', () => ({
  default: (props: any) => <span data-testid="alert-icon" />,
}));

vi.mock('../../src/components/LimitIcon.js', () => ({
  default: (props: any) => <span data-testid="limit-icon" />,
}));

const makeRule = (overrides: Partial<NotificationRule> = {}): NotificationRule => ({
  id: 'rule-1',
  agent_name: 'agent',
  metric_type: 'tokens',
  threshold: 5000,
  period: 'day',
  action: 'notify',
  is_active: true,
  trigger_count: 2,
  created_at: '2026-01-01',
  ...overrides,
});

describe('LimitRuleTable', () => {
  it('renders rules with aria-hidden on decorative SVGs', () => {
    const rules = [makeRule({ action: 'notify', id: 'r1' })];
    const { container } = render(() => (
      <LimitRuleTable
        rules={rules}
        loading={false}
        hasProvider={false}
        onToggleMenu={vi.fn()}
      />
    ));
    // Warning SVG (no provider) should have aria-hidden
    const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders kebab button with aria-label', () => {
    const rules = [makeRule()];
    render(() => (
      <LimitRuleTable
        rules={rules}
        loading={false}
        hasProvider={true}
        onToggleMenu={vi.fn()}
      />
    ));
    expect(screen.getByLabelText('Rule options')).toBeDefined();
  });

  it('shows loading skeleton when loading', () => {
    const { container } = render(() => (
      <LimitRuleTable
        rules={undefined}
        loading={true}
        hasProvider={false}
        onToggleMenu={vi.fn()}
      />
    ));
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('shows empty state when no rules', () => {
    render(() => (
      <LimitRuleTable
        rules={[]}
        loading={false}
        hasProvider={false}
        onToggleMenu={vi.fn()}
      />
    ));
    expect(screen.getByText('No rules yet')).toBeDefined();
  });

  it('renders threshold and period', () => {
    const rules = [makeRule({ threshold: 1000, period: 'day' })];
    const { container } = render(() => (
      <LimitRuleTable
        rules={rules}
        loading={false}
        hasProvider={true}
        onToggleMenu={vi.fn()}
      />
    ));
    expect(container.textContent).toContain('1,000 tokens');
    expect(container.textContent).toContain('per day');
  });
});
