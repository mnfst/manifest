import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import { FallbackIcon, HeartbeatIcon, ModelCell, AgentCell, StatusCell } from '../../src/components/message-table-cells';
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
  // Mirror the real helpers' custom-provider behavior so ModelCell's custom
  // branch is exercised; non-custom inputs behave exactly as before.
  inferProviderFromModel: (m: string) => (m.startsWith('custom:') ? 'custom' : null),
  inferProviderName: (m: string) => m,
  resolveProviderId: (p: string) => (p.startsWith('custom:') ? p : undefined),
  stripCustomPrefix: (m: string) => m.replace(/^custom:[^/]+\//, ''),
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

describe('AgentCell', () => {
  it('renders agent_name when present', () => {
    const row = baseRow({ agent_name: 'my-agent' });
    const { container } = render(() => <table><tbody><tr>{AgentCell(row)}</tr></tbody></table>);
    expect(container.textContent).toContain('my-agent');
  });

  it('renders em dash when agent_name is null', () => {
    const row = baseRow({ agent_name: null });
    const { container } = render(() => <table><tbody><tr>{AgentCell(row)}</tr></tbody></table>);
    expect(container.textContent).toContain('—');
  });
});

describe('StatusCell without agentName (global mode)', () => {
  it('renders plain text for rate_limited when no agentName provided', () => {
    const row = baseRow({ status: 'rate_limited' });
    const { container } = render(() => <table><tbody><tr>{StatusCell(row, undefined)}</tr></tbody></table>);
    // No link, just text
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('rate_limited');
  });

  it('renders link for rate_limited when agentName is provided', () => {
    const row = baseRow({ status: 'rate_limited' });
    const { container } = render(() => <table><tbody><tr>{StatusCell(row, 'my-agent')}</tr></tbody></table>);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toContain('/harnesses/my-agent/limits');
  });
});

describe('ModelCell', () => {
  it('renders header tier badge when header_tier_name is set', () => {
    const row = baseRow({
      header_tier_name: 'My Custom Tier',
      header_tier_color: 'rose',
    });
    const { container } = render(() => <table><tbody><tr>{ModelCell(row)}</tr></tbody></table>);
    const badge = container.querySelector('.tier-badge--custom');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('My Custom Tier');
    expect(badge!.className).toContain('tier-color--rose');
  });

  it('uses indigo as default header tier color', () => {
    const row = baseRow({ header_tier_name: 'Tier A' });
    const { container } = render(() => <table><tbody><tr>{ModelCell(row)}</tr></tbody></table>);
    const badge = container.querySelector('.tier-badge--custom');
    expect(badge).not.toBeNull();
    expect(badge!.className).toContain('tier-color--indigo');
  });

  it('renders a custom row with just the model text and the provider name in the tooltip', () => {
    const row = baseRow({
      model: 'custom:u-1/openai/gpt-oss-120b',
      provider: 'custom:u-1',
      custom_provider_name: 'MyLLM',
    });
    const { container } = render(() => <table><tbody><tr>{ModelCell(row)}</tr></tbody></table>);
    expect(container.textContent).toContain('openai/gpt-oss-120b');
    expect(container.textContent).not.toContain('custom:');
    expect(container.textContent).not.toContain('Custom');
    expect(container.querySelector('[title="MyLLM"]')).not.toBeNull();
  });

  it('falls back to a letter avatar from the model when the custom provider was deleted', () => {
    const row = baseRow({
      model: 'custom:gone/my-model',
      provider: 'custom:gone',
      custom_provider_name: null,
    });
    const { container } = render(() => <table><tbody><tr>{ModelCell(row)}</tr></tbody></table>);
    expect(container.textContent).toContain('my-model');
    expect(container.textContent).not.toContain('custom:');
    const avatar = container.querySelector('.provider-card__logo-letter');
    expect(avatar).not.toBeNull();
    expect(avatar!.textContent).toBe('M');
  });
});
