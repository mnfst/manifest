import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('../../src/components/ModelPickerModal.js', () => ({
  default: (props: {
    onSelect: (tierId: string, model: string, provider: string, auth?: string) => void;
    onClose: () => void;
  }) => {
    return (
      <div data-testid="mock-picker">
        <button
          data-testid="mock-pick"
          onClick={() => props.onSelect('ignored', 'gpt-4o-mini', 'OpenAI', 'api_key')}
        >
          pick gpt-4o-mini
        </button>
        <button data-testid="mock-picker-close" onClick={props.onClose}>
          close
        </button>
      </div>
    );
  },
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => <span data-testid="provider-icon" />,
  customProviderLogo: () => <span data-testid="custom-logo" />,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: (t: string | null | undefined) =>
    t ? <span data-testid={`auth-${t}`} /> : null,
}));

import HeaderTierCard from '../../src/components/HeaderTierCard';
import type { HeaderTier } from '../../src/services/api/header-tiers';

const tier: HeaderTier = {
  id: 'ht-1',
  agent_id: 'a1',
  name: 'Premium',
  header_key: 'x-manifest-tier',
  header_value: 'premium',
  badge_color: 'violet',
  sort_order: 0,
  override_model: 'gpt-4o',
  override_provider: 'openai',
  override_auth_type: 'api_key',
  fallback_models: null,
  created_at: '2026-04-21',
  updated_at: '2026-04-21',
};

describe('HeaderTierCard', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  it('renders ordinal, dot color, name, rule, and model label', () => {
    const { container, getByText } = render(() => (
      <HeaderTierCard
        tier={tier}
        ordinal={2}
        models={[
          {
            model_name: 'gpt-4o',
            display_name: 'GPT-4o',
            provider: 'OpenAI',
            input_price_per_token: 0.000005,
            output_price_per_token: 0.00001,
          } as never,
        ]}
        customProviders={[]}
        connectedProviders={[]}
        onOverride={vi.fn()}
        onReset={vi.fn()}
        onDelete={vi.fn()}
      />
    ));
    expect(getByText('#3').textContent).toBe('#3');
    expect(container.querySelector('.header-tier-card__dot')?.className).toContain(
      'tier-color--violet',
    );
    expect(getByText('Premium')).toBeDefined();
    expect(container.textContent).toContain('x-manifest-tier: premium');
    expect(container.textContent).toContain('GPT-4o');
    expect(container.querySelector('[data-testid="auth-api_key"]')).not.toBeNull();
  });

  it('falls back to raw model name when no display_name is known', () => {
    const { container } = render(() => (
      <HeaderTierCard
        tier={tier}
        ordinal={0}
        models={[]}
        customProviders={[]}
        connectedProviders={[]}
        onOverride={vi.fn()}
        onReset={vi.fn()}
        onDelete={vi.fn()}
      />
    ));
    expect(container.textContent).toContain('gpt-4o');
  });

  it('renders "+ Add model" when override_model is null', () => {
    const emptyTier: HeaderTier = { ...tier, override_model: null };
    const { getByText } = render(() => (
      <HeaderTierCard
        tier={emptyTier}
        ordinal={0}
        models={[]}
        customProviders={[]}
        connectedProviders={[]}
        onOverride={vi.fn()}
        onReset={vi.fn()}
        onDelete={vi.fn()}
      />
    ));
    expect(getByText('+ Add model')).toBeDefined();
  });

  it('opens the model picker and forwards selection to onOverride', async () => {
    const onOverride = vi.fn();
    const { container, getByText, getByTestId } = render(() => (
      <HeaderTierCard
        tier={tier}
        ordinal={0}
        models={[]}
        customProviders={[]}
        connectedProviders={[]}
        onOverride={onOverride}
        onReset={vi.fn()}
        onDelete={vi.fn()}
      />
    ));
    fireEvent.click(container.querySelector('.header-tier-card__model')!);
    fireEvent.click(getByTestId('mock-pick'));
    expect(onOverride).toHaveBeenCalledWith('gpt-4o-mini', 'OpenAI', 'api_key');
  });

  it('Reset button calls onReset', () => {
    const onReset = vi.fn();
    const { getByText } = render(() => (
      <HeaderTierCard
        tier={tier}
        ordinal={0}
        models={[]}
        customProviders={[]}
        connectedProviders={[]}
        onOverride={vi.fn()}
        onReset={onReset}
        onDelete={vi.fn()}
      />
    ));
    fireEvent.click(getByText('Reset'));
    expect(onReset).toHaveBeenCalled();
  });

  it('kebab menu → Delete calls onDelete after confirm', () => {
    const onDelete = vi.fn();
    const { container, getByText } = render(() => (
      <HeaderTierCard
        tier={tier}
        ordinal={0}
        models={[]}
        customProviders={[]}
        connectedProviders={[]}
        onOverride={vi.fn()}
        onReset={vi.fn()}
        onDelete={onDelete}
      />
    ));
    fireEvent.click(container.querySelector('[aria-label="More actions"]')!);
    fireEvent.mouseDown(getByText('Delete tier'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('does not call onDelete when confirm is declined', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const onDelete = vi.fn();
    const { container, getByText } = render(() => (
      <HeaderTierCard
        tier={tier}
        ordinal={0}
        models={[]}
        customProviders={[]}
        connectedProviders={[]}
        onOverride={vi.fn()}
        onReset={vi.fn()}
        onDelete={onDelete}
      />
    ));
    fireEvent.click(container.querySelector('[aria-label="More actions"]')!);
    fireEvent.mouseDown(getByText('Delete tier'));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
