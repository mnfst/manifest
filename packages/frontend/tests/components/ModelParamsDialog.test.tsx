import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import type { ProviderParamSpec } from 'manifest-shared';

import ModelParamsDialog from '../../src/components/ModelParamsDialog';

const q = (sel: string) => document.querySelector(sel);

describe('ModelParamsDialog', () => {
  const deepseekSpecs: ProviderParamSpec[] = [
    {
      key: 'thinking',
      control: {
        kind: 'toggle',
        label: 'Thinking mode',
        values: ['enabled', 'disabled'],
        default: 'enabled',
      },
    },
  ];
  const anthropicSpecs: ProviderParamSpec[] = [
    {
      key: 'max_tokens',
      control: { kind: 'number', label: 'Max tokens', min: 1, default: 4096 },
    },
    {
      key: 'temperature',
      control: { kind: 'slider', label: 'Temperature', min: 0, max: 1, step: 0.1, default: 1 },
    },
    {
      key: 'top_p',
      control: { kind: 'slider', label: 'Top P', min: 0, max: 1, step: 0.01, default: 1 },
    },
    {
      key: 'top_k',
      control: { kind: 'number', label: 'Top K', min: 0, default: 0 },
    },
  ];
  const baseProps = {
    open: true,
    slotLabel: 'deepseek-v4-flash',
    current: null as null | Record<string, unknown>,
    specs: deepseekSpecs,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(() => <ModelParamsDialog {...baseProps} open={false} />);
    expect(q('.modal-overlay')).toBeNull();
  });

  it('starts on the provider default when no override is configured', () => {
    render(() => <ModelParamsDialog {...baseProps} />);
    const toggle = q('.model-params__toggle') as HTMLButtonElement;
    // DeepSeek's natural default for `thinking` is `enabled`, per the spec.
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(q('.provider-toggle__switch--on')).not.toBeNull();
  });

  it('reflects the configured override when present', () => {
    render(() => <ModelParamsDialog {...baseProps} current={{ thinking: 'disabled' }} />);
    const toggle = q('.model-params__toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(q('.provider-toggle__switch--on')).toBeNull();
  });

  it("renders the spec's natural default in the hint text", () => {
    render(() => <ModelParamsDialog {...baseProps} />);
    // DeepSeek's spec default is `enabled`.
    expect(q('.model-params__label-hint')!.textContent).toContain('enabled');
  });

  it("renders the spec's label as the row title", () => {
    render(() => <ModelParamsDialog {...baseProps} />);
    expect(q('.model-params__label-title')!.textContent).toContain('Thinking mode');
  });

  it("renders the raw spec key as developer metadata", () => {
    render(() => <ModelParamsDialog {...baseProps} />);
    expect(q('.model-params__param-key')!.textContent).toBe('thinking');
  });

  it('saves null when every chosen value matches the provider default', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        onSave={onSave}
        current={{ thinking: 'disabled' }}
      />
    ));

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement); // disabled → enabled
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('saves an explicit override when at least one value differs from the provider default', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(() => (
      <ModelParamsDialog {...baseProps} onSave={onSave} onClose={onClose} />
    ));

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement); // enabled → disabled
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ thinking: 'disabled' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('renders nothing for providers with no spec entries', () => {
    render(() => <ModelParamsDialog {...baseProps} specs={[]} />);
    // The dialog still mounts (open=true), but no rows render — the For
    // over zero spec entries collapses to nothing. Saving with no rows
    // produces the empty payload → null.
    expect(q('.model-params__row')).toBeNull();
  });

  it('cancel button closes without persisting', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(() => (
      <ModelParamsDialog {...baseProps} onSave={onSave} onClose={onClose} />
    ));

    fireEvent.click(screen.getByText('Cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape key closes the dialog', () => {
    const onClose = vi.fn();
    render(() => <ModelParamsDialog {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(q('.modal-card')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the overlay closes the dialog', () => {
    const onClose = vi.fn();
    render(() => <ModelParamsDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(q('.modal-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close mid-save when the user re-clicks the overlay', async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onClose = vi.fn();
    render(() => <ModelParamsDialog {...baseProps} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByText('Save'));
    fireEvent.click(q('.modal-overlay')!);
    expect(onClose).not.toHaveBeenCalled();
    resolveSave!();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('renders a select control from the registry and saves its UI value', async () => {
    const specs: ProviderParamSpec[] = [
      {
        key: 'reasoning_effort',
        control: {
          kind: 'select',
          label: 'Reasoning effort',
          values: ['low', 'medium', 'high'],
          default: 'medium',
        },
      },
    ];
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => <ModelParamsDialog {...baseProps} specs={specs} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reasoning effort' }));
    fireEvent.click(screen.getByRole('option', { name: 'high' }));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ reasoning_effort: 'high' }));
  });

  it('renders a slider control and clamps numeric input to the configured range', async () => {
    const specs: ProviderParamSpec[] = [
      {
        key: 'temperature',
        control: {
          kind: 'slider',
          label: 'Temperature',
          min: 0,
          max: 2,
          step: 0.1,
          default: 1,
        },
      },
    ];
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => <ModelParamsDialog {...baseProps} specs={specs} onSave={onSave} />);

    const slider = screen.getByRole('slider', { name: 'Temperature' });
    expect(document.querySelector('input[type="range"]')).toBeNull();
    fireEvent.keyDown(slider, { key: 'End' });
    fireEvent.click(screen.getByText('Save'));

    expect(slider.getAttribute('style')).toContain('--model-params-slider-progress: 100%');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ temperature: 2 }));
  });

  it('renders Anthropic API-key scalar params from resolved specs', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        specs={anthropicSpecs}
        onSave={onSave}
      />
    ));

    const temperatureSlider = screen.getByRole('slider', { name: 'Temperature' });
    const topPSlider = screen.getByRole('slider', { name: 'Top P' });
    fireEvent.input(screen.getByLabelText('Max tokens'), { target: { value: '2048' } });
    fireEvent.input(screen.getByLabelText('Temperature value'), { target: { value: '0.4' } });
    fireEvent.input(screen.getByLabelText('Top P value'), { target: { value: '0.8' } });
    fireEvent.input(screen.getByLabelText('Top K'), { target: { value: '40' } });
    fireEvent.click(screen.getByText('Save'));

    expect(temperatureSlider.getAttribute('style')).toContain('--model-params-slider-progress: 40%');
    expect(topPSlider.getAttribute('style')).toContain('--model-params-slider-progress: 80%');
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        max_tokens: 2048,
        temperature: 0.4,
        top_p: 0.8,
        top_k: 40,
      }),
    );
  });

  it('renders a number control and stores numbers instead of input strings', async () => {
    const specs: ProviderParamSpec[] = [
      {
        key: 'budget_tokens',
        control: { kind: 'number', label: 'Budget tokens', min: 1024, max: 4096, default: 2048 },
      },
    ];
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => <ModelParamsDialog {...baseProps} specs={specs} onSave={onSave} />);

    fireEvent.input(screen.getByLabelText('Budget tokens'), { target: { value: '3072' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ budget_tokens: 3072 }));
  });
});
