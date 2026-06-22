import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import { FallbackIcon, HeartbeatIcon, ModelCell } from '../../src/components/message-table-cells';
import type { MessageRow } from '../../src/components/message-table-types';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock('../../src/services/formatters.js', () => ({
  formatCost: (v: number) => `$${v.toFixed(2)}`,
  formatNumber: (v: number) => String(v),
  formatStatus: (s: string) => s,
  formatTime: (t: string) => t,
  formatDuration: (ms: number) => `${ms}ms`,
  formatErrorMessage: (s: string) => s,
  customProviderColor: () => '#6366f1',
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  inferProviderFromModel: () => null,
  inferProviderName: (m: string) => m,
  resolveProviderId: () => undefined,
  stripCustomPrefix: (m: string) => m,
}));

vi.mock('../../src/services/model-display.js', () => ({
  getModelDisplayName: (slug: string) => slug,
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: () => null, customProviderLogo: () => null,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: () => null,
  authLabel: () => 'API Key',
}));

vi.mock('../../src/components/InfoTooltip.jsx', () => ({
  default: (props: any) => <span title={props.text} />,
}));

function baseRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: '1',
    timestamp: '2025-01-01T00:00:00Z',
    agent_name: 'demo',
    model: 'gpt-4o',
    input_tokens: 100,
    output_tokens: 50,
    total_tokens: 150,
    cost: 0.01,
    status: 'success',
    ...overrides,
  };
}

describe('FallbackIcon', () => {
  it('renders with aria-hidden', () => {
    const { container } = render(() => <FallbackIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('HeartbeatIcon', () => {
  it('renders with aria-hidden', () => {
    const { container } = render(() => <HeartbeatIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('ModelCell', () => {
  const noCustom = () => undefined;

  it('renders header tier badge when header_tier_name is set', () => {
    const row = baseRow({
      header_tier_name: 'My Custom Tier',
      header_tier_color: 'rose',
    });
    const { container } = render(() => <table><tbody><tr>{ModelCell(row, noCustom)}</tr></tbody></table>);
    const badge = container.querySelector('.tier-badge--custom');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('My Custom Tier');
    expect(badge!.className).toContain('tier-color--rose');
  });

  it('uses indigo as default header tier color', () => {
    const row = baseRow({ header_tier_name: 'Tier A' });
    const { container } = render(() => <table><tbody><tr>{ModelCell(row, noCustom)}</tr></tbody></table>);
    const badge = container.querySelector('.tier-badge--custom');
    expect(badge).not.toBeNull();
    expect(badge!.className).toContain('tier-color--indigo');
  });
});
