import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import type { ProviderParamSpecCatalog } from 'manifest-shared';
import ModelParamsAffordance from '../../src/components/ModelParamsAffordance';

const specCatalog: ProviderParamSpecCatalog = [
  {
    provider: 'deepseek',
    authType: 'api_key',
    model: 'deepseek-v4',
    params: [
      {
        path: 'thinking.type',
        type: 'enum',
        label: 'Thinking mode',
        description: 'Controls whether DeepSeek thinking mode is enabled.',
        default: 'enabled',
        values: ['enabled', 'disabled'],
        group: 'reasoning',
      },
    ],
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
  it('renders the button when the route model has MPS specs', () => {
    const { container } = render(() => <ModelParamsAffordance {...baseProps} />);
    const btn = container.querySelector('button[aria-label^="Configure model parameters"]');
    expect(btn).not.toBeNull();
  });

  it('opens a model with no parameters and links to the request template', async () => {
    const { container } = render(() => (
      <ModelParamsAffordance {...baseProps} provider="openai" model="gpt-4o" slotLabel="gpt-4o" />
    ));
    const btn = container.querySelector(
      'button[aria-label="Configure model parameters for gpt-4o"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();

    fireEvent.click(btn);

    await waitFor(() =>
      expect(screen.getByText('No parameter controls are published for gpt-4o yet.')).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

    const link = screen.getByRole('link', {
      name: 'Request model parameters for gpt-4o',
    }) as HTMLAnchorElement;
    expect(link.textContent).toBe('Request parameters for this model');
    const url = new URL(link.href);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/mnfst/modelparams.dev/issues/new',
    );
    expect(url.searchParams.get('template')).toBe('parameter-request.yml');
    expect(url.searchParams.get('title')).toBe('openai/gpt-4o: parameter coverage');
    expect(url.searchParams.get('provider')).toBe('openai');
    expect(url.searchParams.get('model')).toBe('gpt-4o');
    expect(url.searchParams.get('auth-type')).toBe('API key');
  });

  it('prefills subscription auth type in the request template', async () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        {...baseProps}
        authType="subscription"
        provider="anthropic"
        model="claude-sonnet-4-6"
        slotLabel="Claude Sonnet 4.6"
      />
    ));

    fireEvent.click(
      container.querySelector(
        'button[aria-label="Configure model parameters for Claude Sonnet 4.6"]',
      ) as HTMLButtonElement,
    );

    const link = (await waitFor(() =>
      screen.getByRole('link', {
        name: 'Request model parameters for Claude Sonnet 4.6',
      }),
    )) as HTMLAnchorElement;
    const url = new URL(link.href);
    expect(url.searchParams.get('title')).toBe('anthropic/claude-sonnet-4-6: parameter coverage');
    expect(url.searchParams.get('auth-type')).toBe('Subscription');
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

  it('does not render the button for local routes', () => {
    const { container } = render(() => <ModelParamsAffordance {...baseProps} authType="local" />);
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
    expect(getByRole('link', { name: 'Request parameters for deepseek-v4' })).toBeTruthy();
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
