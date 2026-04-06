import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import { FallbackIcon, HeartbeatIcon } from '../../src/components/message-table-cells';

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
