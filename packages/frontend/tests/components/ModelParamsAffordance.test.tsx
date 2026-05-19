import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { ProviderParamSpecCatalog } from 'manifest-shared';
import ModelParamsAffordance from '../../src/components/ModelParamsAffordance';

const specCatalog: ProviderParamSpecCatalog = [
  {
    provider: 'deepseek',
    authType: 'api_key',
    model: 'deepseek-v4',
    path: 'thinking.type',
    type: 'enum',
    label: 'Thinking mode',
    default: 'enabled',
    values: ['enabled', 'disabled'],
    group: 'reasoning',
  },
];

const baseProps = {
  provider: 'deepseek',
  authType: 'api_key' as const,
  model: 'deepseek-v4',
  slotLabel: 'deepseek-v4',
  scope: 'tier:default',
  specCatalog,
  getParams: vi.fn(() => null),
  setParams: vi.fn().mockResolvedValue(undefined),
};

describe('ModelParamsAffordance', () => {
  it('renders the button when the route model has DB-backed specs', () => {
    const { container } = render(() => <ModelParamsAffordance {...baseProps} />);
    const btn = container.querySelector('button[aria-label^="Configure model parameters"]');
    expect(btn).not.toBeNull();
  });

  it('does not render the button when the resolved model has no specs', () => {
    const { container } = render(() => (
      <ModelParamsAffordance {...baseProps} provider="openai" model="gpt-4o" />
    ));
    expect(container.querySelector('button[aria-label^="Configure model parameters"]')).toBeNull();
  });

  it('does not render the button when authType is missing', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        provider="deepseek"
        authType={undefined}
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:default"
        specCatalog={specCatalog}
        getParams={() => null}
        setParams={vi.fn()}
      />
    ));
    expect(container.querySelector('button[aria-label^="Configure model parameters"]')).toBeNull();
  });

  it('does not render the button when provider is undefined', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        provider={undefined}
        authType="api_key"
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:default"
        specCatalog={specCatalog}
        getParams={() => null}
        setParams={vi.fn()}
      />
    ));
    expect(container.querySelector('button[aria-label^="Configure model parameters"]')).toBeNull();
  });

  it('flips the configured class when getParams returns a non-null value', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        {...baseProps}
        getParams={() => ({ thinking: { type: 'disabled' } })}
      />
    ));
    const btn = container.querySelector(
      'button[aria-label^="Configure model parameters"]',
    ) as HTMLButtonElement;
    expect(btn.classList.contains('routing-card__chip-action--configured')).toBe(true);
  });

  it('opens the dialog and saves through the scoped params callback', async () => {
    const setParams = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(() => (
      <ModelParamsAffordance {...baseProps} setParams={setParams} />
    ));
    fireEvent.click(
      container.querySelector(
        'button[aria-label^="Configure model parameters"]',
      ) as HTMLButtonElement,
    );

    fireEvent.click(await waitFor(() => getByRole('button', { name: /Thinking mode/ })));
    fireEvent.click(getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(setParams).toHaveBeenCalledWith('tier:default', 'deepseek', 'api_key', 'deepseek-v4', {
        thinking: { type: 'disabled' },
      });
    });
  });

  it('saves null when the chosen value collapses back to the spec default', async () => {
    const setParams = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(() => (
      <ModelParamsAffordance
        {...baseProps}
        getParams={() => ({ thinking: { type: 'disabled' } })}
        setParams={setParams}
      />
    ));
    fireEvent.click(
      container.querySelector(
        'button[aria-label^="Configure model parameters"]',
      ) as HTMLButtonElement,
    );

    fireEvent.click(await waitFor(() => getByRole('button', { name: /Thinking mode/ })));
    fireEvent.click(getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(setParams).toHaveBeenCalledWith(
        'tier:default',
        'deepseek',
        'api_key',
        'deepseek-v4',
        null,
      );
    });
  });

  it('button is disabled when the parent says so', () => {
    const { container } = render(() => <ModelParamsAffordance {...baseProps} disabled />);
    const btn = container.querySelector(
      'button[aria-label^="Configure model parameters"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
