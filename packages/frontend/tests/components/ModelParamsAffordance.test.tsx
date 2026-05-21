import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { ProviderParamSpec } from 'manifest-shared';
import ModelParamsAffordance from '../../src/components/ModelParamsAffordance';
import { getModelParamSpecs } from '../../src/services/api/model-params.js';

vi.mock('../../src/services/api/model-params.js', () => ({
  getModelParamSpecs: vi.fn(),
}));

const mockGetSpecs = vi.mocked(getModelParamSpecs);

const specs: ProviderParamSpec[] = [
  {
    path: 'thinking.type',
    type: 'enum',
    label: 'Thinking mode',
    description: 'Controls whether DeepSeek thinking mode is enabled.',
    default: 'enabled',
    values: ['enabled', 'disabled'],
    group: 'reasoning',
  },
];

const baseProps = {
  agentName: 'demo',
  provider: 'deepseek',
  authType: 'api_key' as const,
  model: 'deepseek-v4',
  slotLabel: 'deepseek-v4',
  scope: 'tier:default',
  getParams: vi.fn(() => null),
  setParams: vi.fn().mockResolvedValue(undefined),
};

const findButton = (container: HTMLElement) =>
  container.querySelector('button[aria-label^="Configure model parameters"]');

describe('ModelParamsAffordance', () => {
  beforeEach(() => {
    mockGetSpecs.mockReset();
    mockGetSpecs.mockResolvedValue(specs);
  });

  it('renders the button when the route has a resolved provider and auth', () => {
    const { container } = render(() => <ModelParamsAffordance {...baseProps} />);
    expect(findButton(container)).not.toBeNull();
  });

  it('still renders the button optimistically without preloading specs', () => {
    // No catalog at render time: the button shows for any resolved route and
    // the spec set is only fetched on open.
    const { container } = render(() => (
      <ModelParamsAffordance {...baseProps} provider="openai" model="gpt-4o" />
    ));
    expect(findButton(container)).not.toBeNull();
    expect(mockGetSpecs).not.toHaveBeenCalled();
  });

  it('does not render the button when authType is missing', () => {
    // Explicit props (no spread): Solid's mergeProps skips `undefined`
    // overrides, so spreading baseProps would keep the truthy value.
    const { container } = render(() => (
      <ModelParamsAffordance
        agentName="demo"
        provider="deepseek"
        authType={undefined}
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:default"
        getParams={() => null}
        setParams={vi.fn()}
      />
    ));
    expect(findButton(container)).toBeNull();
  });

  it('does not render the button when provider is undefined', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        agentName="demo"
        provider={undefined}
        authType="api_key"
        model="deepseek-v4"
        slotLabel="deepseek-v4"
        scope="tier:default"
        getParams={() => null}
        setParams={vi.fn()}
      />
    ));
    expect(findButton(container)).toBeNull();
  });

  it('flips the configured class when getParams returns a non-null value', () => {
    const { container } = render(() => (
      <ModelParamsAffordance
        {...baseProps}
        getParams={() => ({ thinking: { type: 'disabled' } })}
      />
    ));
    const btn = findButton(container) as HTMLButtonElement;
    expect(btn.classList.contains('routing-card__chip-action--configured')).toBe(true);
  });

  it('fetches specs on open and saves through the scoped params callback', async () => {
    const setParams = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(() => (
      <ModelParamsAffordance {...baseProps} setParams={setParams} />
    ));
    fireEvent.click(findButton(container) as HTMLButtonElement);

    fireEvent.click(await waitFor(() => getByRole('button', { name: /Thinking mode/ })));
    fireEvent.click(getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(setParams).toHaveBeenCalledWith('tier:default', 'deepseek', 'api_key', 'deepseek-v4', {
        thinking: { type: 'disabled' },
      });
    });
    expect(mockGetSpecs).toHaveBeenCalledWith('demo', 'deepseek', 'api_key', 'deepseek-v4');
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
    fireEvent.click(findButton(container) as HTMLButtonElement);

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

  it('shows an empty state when the model has no configurable params', async () => {
    mockGetSpecs.mockResolvedValue([]);
    const { container, findByText, queryByRole } = render(() => (
      <ModelParamsAffordance {...baseProps} />
    ));
    fireEvent.click(findButton(container) as HTMLButtonElement);

    expect(await findByText('This model has no configurable parameters.')).toBeTruthy();
    expect(queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('swallows a fetch error and shows the empty state', async () => {
    mockGetSpecs.mockRejectedValue(new Error('boom'));
    const { container, findByText } = render(() => <ModelParamsAffordance {...baseProps} />);
    fireEvent.click(findButton(container) as HTMLButtonElement);

    expect(await findByText('This model has no configurable parameters.')).toBeTruthy();
  });

  it('button is disabled when the parent says so', () => {
    const { container } = render(() => <ModelParamsAffordance {...baseProps} disabled />);
    const btn = findButton(container) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
