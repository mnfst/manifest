import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import {
  RoutingFooter,
  ActiveProviderIcons,
  RoutingLoadingSkeleton,
} from '../../src/pages/RoutingPanels';
import type { RoutingProvider, CustomProviderData } from '../../src/services/api';

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: (id: string) => <span data-testid={`prov-icon-${id}`} />,
  customProviderLogo: () => null,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: (auth: string | null | undefined) =>
    auth ? <span data-testid={`auth-${auth}`} /> : null,
  authLabel: (auth: string | null | undefined) =>
    auth === 'subscription' ? 'Subscription' : auth === 'local' ? 'Local' : 'API Key',
}));

vi.mock('../../src/services/providers.js', () => ({
  STAGES: [
    { id: 'simple', step: 1, label: 'Simple', desc: 'Simple desc' },
    { id: 'standard', step: 2, label: 'Standard', desc: 'Standard desc' },
  ],
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
  ],
}));

vi.mock('../../src/services/formatters.js', () => ({
  customProviderColor: () => '#000',
}));

describe('RoutingFooter', () => {
  it('renders setup instructions but no Disable routing button', () => {
    const onResetAll = vi.fn();
    const onShowInstructions = vi.fn();
    render(() => (
      <RoutingFooter
        hasOverrides={() => false}
        resettingAll={() => false}
        resettingTier={() => null}
        onResetAll={onResetAll}
        onShowInstructions={onShowInstructions}
      />
    ));
    expect(screen.getByRole('button', { name: 'Setup instructions' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /disable routing/i })).toBeNull();
  });

  it('shows the reset-all button when there are overrides', () => {
    render(() => (
      <RoutingFooter
        hasOverrides={() => true}
        resettingAll={() => false}
        resettingTier={() => null}
        onResetAll={vi.fn()}
        onShowInstructions={vi.fn()}
      />
    ));
    expect(screen.getByRole('button', { name: 'Reset all to auto' })).toBeDefined();
  });

  it('disables reset-all while resettingAll is true and shows a spinner', () => {
    const { container } = render(() => (
      <RoutingFooter
        hasOverrides={() => true}
        resettingAll={() => true}
        resettingTier={() => null}
        onResetAll={vi.fn()}
        onShowInstructions={vi.fn()}
      />
    ));
    const btn = container.querySelector('.btn--outline') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.querySelector('.spinner')).not.toBeNull();
  });

  it('disables reset-all when an individual tier is being reset', () => {
    const { container } = render(() => (
      <RoutingFooter
        hasOverrides={() => true}
        resettingAll={() => false}
        resettingTier={() => 'simple'}
        onResetAll={vi.fn()}
        onShowInstructions={vi.fn()}
      />
    ));
    const btn = container.querySelector('.btn--outline') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('fires onResetAll when reset-all is clicked', () => {
    const onResetAll = vi.fn();
    render(() => (
      <RoutingFooter
        hasOverrides={() => true}
        resettingAll={() => false}
        resettingTier={() => null}
        onResetAll={onResetAll}
        onShowInstructions={vi.fn()}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Reset all to auto' }));
    expect(onResetAll).toHaveBeenCalled();
  });

  it('fires onShowInstructions when the setup link is clicked', () => {
    const onShowInstructions = vi.fn();
    render(() => (
      <RoutingFooter
        hasOverrides={() => false}
        resettingAll={() => false}
        resettingTier={() => null}
        onResetAll={vi.fn()}
        onShowInstructions={onShowInstructions}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Setup instructions' }));
    expect(onShowInstructions).toHaveBeenCalled();
  });
});

describe('RoutingLoadingSkeleton', () => {
  it('renders one skeleton card per STAGES entry', () => {
    const { container } = render(() => <RoutingLoadingSkeleton />);
    expect(container.querySelectorAll('.routing-card').length).toBe(2);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});

describe('ActiveProviderIcons', () => {
  it('renders one icon per active built-in provider with the auth badge', () => {
    const providers: RoutingProvider[] = [
      {
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
        has_api_key: true,
        connected_at: '2025-01-01',
      },
      {
        id: 'p2',
        provider: 'anthropic',
        auth_type: 'subscription',
        is_active: true,
        has_api_key: false,
        connected_at: '2025-01-01',
      },
    ];
    const { container } = render(() => (
      <ActiveProviderIcons activeProviders={() => providers} customProviders={() => []} />
    ));
    expect(container.querySelector('[data-testid="prov-icon-openai"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="prov-icon-anthropic"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-api_key"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-subscription"]')).not.toBeNull();
  });

  it('renders the connection count label (singular vs plural)', () => {
    const single: RoutingProvider[] = [
      {
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
        has_api_key: true,
        connected_at: '2025-01-01',
      },
    ];
    const { container, unmount } = render(() => (
      <ActiveProviderIcons activeProviders={() => single} customProviders={() => []} />
    ));
    expect(container.textContent).toMatch(/1 connection(?!s)/);
    unmount();

    const multi: RoutingProvider[] = [
      ...single,
      { ...single[0], id: 'p2', provider: 'anthropic' },
    ];
    const { container: c2 } = render(() => (
      <ActiveProviderIcons activeProviders={() => multi} customProviders={() => []} />
    ));
    expect(c2.textContent).toMatch(/2 connections/);
  });

  it('renders the custom-provider letter logo when no logo URL is present', () => {
    const providers: RoutingProvider[] = [
      {
        id: 'p1',
        provider: 'custom:cp-1',
        auth_type: 'api_key',
        is_active: true,
        has_api_key: true,
        connected_at: '2025-01-01',
      },
    ];
    const customProviders: CustomProviderData[] = [
      {
        id: 'cp-1',
        name: 'Groq',
        base_url: 'https://api.groq.com',
        api_kind: 'openai',
        has_api_key: true,
        models: [],
        created_at: '2025-01-01',
      },
    ];
    const { container } = render(() => (
      <ActiveProviderIcons activeProviders={() => providers} customProviders={() => customProviders} />
    ));
    const letter = container.querySelector('.provider-card__logo-letter');
    expect(letter?.textContent).toBe('G');
  });

  it('falls back to "C" when the custom provider id is unknown', () => {
    const providers: RoutingProvider[] = [
      {
        id: 'p1',
        provider: 'custom:unknown',
        auth_type: 'api_key',
        is_active: true,
        has_api_key: true,
        connected_at: '2025-01-01',
      },
    ];
    const { container } = render(() => (
      <ActiveProviderIcons activeProviders={() => providers} customProviders={() => []} />
    ));
    expect(container.querySelector('.provider-card__logo-letter')?.textContent).toBe('C');
  });
});
