import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { ProviderParamSpecRegistry } from 'manifest-shared';
import ModelParamsAffordance from '../../src/components/ModelParamsAffordance';

describe('ModelParamsAffordance', () => {
  const specRegistry: ProviderParamSpecRegistry = {
    'deepseek:api_key': {
      base: [
        {
          key: 'thinking',
          control: {
            kind: 'toggle',
            label: 'Thinking mode',
            values: ['enabled', 'disabled'],
            default: 'enabled',
          },
        },
      ],
    },
  };

  it('renders the button when the route provider consumes a known param key', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        specRegistry={specRegistry}
        provider="deepseek"
        authType="api_key"
        model="deepseek-v4"
        slotLabel="deepseek-v4-flash"
        scope="tier:simple"
        getParams={() => null}
        setParams={vi.fn()}
      />
    ));
    const btn = container.querySelector('button[aria-label^="Configure model parameters"]');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('title')).toBeNull();
  });

  it('does NOT render the button when the provider has no known param key', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        specRegistry={specRegistry}
        provider="openai"
        authType="api_key"
        model="gpt-4o"
        slotLabel="gpt-4o"
        scope="tier:simple"
        getParams={() => null}
        setParams={vi.fn()}
      />
    ));
    expect(container.querySelector('button[aria-label^="Configure model parameters"]')).toBeNull();
  });

  it('does NOT render the button when authType is missing (can not call the endpoint)', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        specRegistry={specRegistry}
        provider="deepseek"
        authType={undefined}
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:simple"
        getParams={() => null}
        setParams={vi.fn()}
      />
    ));
    expect(container.querySelector('button[aria-label^="Configure model parameters"]')).toBeNull();
  });

  it('does NOT render the button when provider is undefined', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        specRegistry={specRegistry}
        provider={undefined}
        authType="api_key"
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:simple"
        getParams={() => null}
        setParams={vi.fn()}
      />
    ));
    expect(container.querySelector('button[aria-label^="Configure model parameters"]')).toBeNull();
  });

  it('flips the configured class when getParams returns a non-null value', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        specRegistry={specRegistry}
        provider="deepseek"
        authType="api_key"
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:simple"
        getParams={() => ({ thinking: 'disabled' })}
        setParams={vi.fn()}
      />
    ));
    const btn = container.querySelector(
      'button[aria-label^="Configure model parameters"]',
    ) as HTMLButtonElement;
    expect(btn.classList.contains('routing-card__chip-action--configured')).toBe(true);
  });

  it('opens the dialog on click and calls setParams with the new value on save', async () => {
    const setParams = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(() => (
      <ModelParamsAffordance
        specRegistry={specRegistry}
        provider="deepseek"
        authType="api_key"
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:simple"
        getParams={() => null}
        setParams={setParams}
      />
    ));
    const btn = container.querySelector(
      'button[aria-label^="Configure model parameters"]',
    ) as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.classList.contains('routing-card__chip-action--dialog-open')).toBe(true);

    // Dialog mounts. Flip the thinking toggle to `disabled` (provider default
    // is `enabled` so the dialog seeded that), then save.
    const toggle = await waitFor(() => getByRole('button', { name: /Thinking mode/ }));
    fireEvent.click(toggle);
    const save = getByRole('button', { name: 'Save' });
    fireEvent.click(save);

    await waitFor(() => {
      expect(setParams).toHaveBeenCalledWith('tier:simple', 'deepseek', 'api_key', 'deepseek-v4', {
        thinking: 'disabled',
      });
    });
  });

  it('calls setParams with null when the chosen value collapses back to the provider default', async () => {
    const setParams = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(() => (
      <ModelParamsAffordance
        specRegistry={specRegistry}
        provider="deepseek"
        authType="api_key"
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:simple"
        getParams={() => ({ thinking: 'disabled' })}
        setParams={setParams}
      />
    ));
    const btn = container.querySelector(
      'button[aria-label^="Configure model parameters"]',
    ) as HTMLButtonElement;
    fireEvent.click(btn);

    // Saved as disabled. Toggle back to enabled (the provider default), then
    // save — the dialog passes `null` so the parent deletes the row.
    const toggle = await waitFor(() => getByRole('button', { name: /Thinking mode/ }));
    fireEvent.click(toggle);
    const save = getByRole('button', { name: 'Save' });
    fireEvent.click(save);

    await waitFor(() => {
      expect(setParams).toHaveBeenCalledWith(
        'tier:simple',
        'deepseek',
        'api_key',
        'deepseek-v4',
        null,
      );
    });
  });

  it('button is disabled when the parent says so', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        specRegistry={specRegistry}
        provider="deepseek"
        authType="api_key"
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:simple"
        getParams={() => null}
        setParams={vi.fn()}
        disabled
      />
    ));
    const btn = container.querySelector(
      'button[aria-label^="Configure model parameters"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
