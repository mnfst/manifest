import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import type { ProviderParamSpec, RequestParamDefaults } from 'manifest-shared';

import ModelParamsDialog from '../../src/components/ModelParamsDialog';

const q = (sel: string) => document.querySelector(sel);

const pointerEvent = (type: string, clientX: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    pointerId: { value: 1 },
  });
  return event;
};

const deepseekSpecs: readonly ProviderParamSpec[] = [
  {
    provider: 'deepseek',
    authType: 'api_key',
    model: 'deepseek-v4',
    path: 'thinking.type',
    type: 'enum',
    label: 'Thinking mode',
    description: 'Controls whether DeepSeek thinking mode is enabled.',
    default: 'enabled',
    values: ['enabled', 'disabled'],
    group: 'reasoning',
  },
];

const anthropicSpecs: readonly ProviderParamSpec[] = [
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'thinking.type',
    type: 'enum',
    label: 'Thinking mode',
    description: 'Controls Anthropic thinking mode.',
    default: 'disabled',
    values: ['disabled', 'adaptive', 'enabled'],
    group: 'reasoning',
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'thinking.budget_tokens',
    type: 'integer',
    label: 'Thinking budget',
    description: 'Maximum Anthropic extended thinking token budget.',
    default: 4096,
    range: { min: 1024, max: 32768, step: 1024 },
    group: 'reasoning',
    applicability: { only: { 'thinking.type': 'enabled' } },
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'temperature',
    type: 'number',
    label: 'Temperature',
    description: 'Controls sampling randomness.',
    default: 1,
    range: { min: 0, max: 1, step: 0.1 },
    group: 'sampling',
    applicability: { except: { 'thinking.type': ['enabled', 'adaptive'] } },
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'top_p',
    type: 'number',
    label: 'Top P',
    description: 'Controls nucleus sampling.',
    default: 1,
    range: { min: 0, max: 1, step: 0.01 },
    group: 'sampling',
    applicability: {
      except: [{ 'thinking.type': ['enabled', 'adaptive'] }, { temperature: { not: 1 } }],
    },
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'max_tokens',
    type: 'integer',
    label: 'Max tokens',
    description: 'Maximum number of output tokens.',
    default: 4096,
    range: { min: 1 },
    group: 'generation_length',
  },
];

const booleanSpecs: readonly ProviderParamSpec[] = [
  {
    provider: 'test',
    authType: 'api_key',
    model: 'test-model',
    path: 'logprobs',
    type: 'boolean',
    label: 'Token log probabilities',
    description: 'Controls whether token log probabilities are requested.',
    default: true,
    group: 'observability',
  },
];

describe('ModelParamsDialog', () => {
  const baseProps = {
    open: true,
    slotLabel: 'deepseek-v4',
    current: null as RequestParamDefaults | null,
    specs: deepseekSpecs,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when closed', () => {
    render(() => <ModelParamsDialog {...baseProps} open={false} />);
    expect(q('.modal-overlay')).toBeNull();
  });

  it('starts on the spec default when no override is configured', () => {
    render(() => <ModelParamsDialog {...baseProps} />);
    const toggle = q('.model-params__toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(q('.provider-toggle__switch--on')).not.toBeNull();
  });

  it('reflects the configured override when present', () => {
    render(() => <ModelParamsDialog {...baseProps} current={{ thinking: { type: 'disabled' } }} />);
    const toggle = q('.model-params__toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(q('.provider-toggle__switch--on')).toBeNull();
  });

  it('shows the human label and raw provider param path', () => {
    render(() => (
      <ModelParamsDialog {...baseProps} specs={anthropicSpecs} slotLabel="claude-sonnet-4-6" />
    ));
    expect(screen.getByText('Max tokens')).toBeTruthy();
    expect(screen.getByText('max_tokens')).toBeTruthy();
    expect(screen.getByText('Maximum number of output tokens.')).toBeTruthy();
    expect(screen.getByText('Default: 4096')).toBeTruthy();
  });

  it('renders derived select, slider, and number controls from specs', () => {
    render(() => (
      <ModelParamsDialog {...baseProps} specs={anthropicSpecs} slotLabel="claude-sonnet-4-6" />
    ));
    expect(screen.getByLabelText('Thinking mode')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Temperature' })).toBeTruthy();
    expect(screen.getByLabelText('Max tokens')).toBeTruthy();
  });

  it('updates slider controls from keyboard input', () => {
    render(() => (
      <ModelParamsDialog {...baseProps} specs={anthropicSpecs} slotLabel="claude-sonnet-4-6" />
    ));

    const slider = screen.getByRole('slider', { name: 'Temperature' });
    const input = screen.getByLabelText('Temperature value') as HTMLInputElement;

    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(input.value).toBe('0.9');

    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(input.value).toBe('1');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(input.value).toBe('0');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(input.value).toBe('1');
  });

  it('updates scrub controls from pointer drag', () => {
    render(() => (
      <ModelParamsDialog {...baseProps} specs={anthropicSpecs} slotLabel="claude-sonnet-4-6" />
    ));

    const scrub = screen.getByRole('slider', { name: 'Temperature' }) as HTMLDivElement;
    const input = screen.getByLabelText('Temperature value') as HTMLInputElement;
    scrub.setPointerCapture = vi.fn();
    scrub.hasPointerCapture = vi.fn(() => true);
    scrub.releasePointerCapture = vi.fn();

    // Default temperature is 1. pixelsPerUnit = 120 / (1 - 0) = 120.
    // pointerdown at 100 sets startX=100, startValue=1.
    fireEvent(scrub, pointerEvent('pointerdown', 100));
    expect(input.value).toBe('1');

    // pointermove to 40: delta = (40-100)/120 = -0.5, value = 1 + -0.5 = 0.5
    fireEvent(scrub, pointerEvent('pointermove', 40));
    expect(input.value).toBe('0.5');
  });

  it('stores integer number controls as parsed numeric values', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        specs={anthropicSpecs}
        slotLabel="claude-sonnet-4-6"
        onSave={onSave}
      />
    ));

    fireEvent.input(screen.getByLabelText('Max tokens'), { target: { value: '2048.9' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ max_tokens: 2048 }));
  });

  it('saves null when every chosen value matches the spec default', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        onSave={onSave}
        current={{ thinking: { type: 'disabled' } }}
      />
    ));

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement);
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('saves an explicit override when at least one value differs from the spec default', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(() => <ModelParamsDialog {...baseProps} onSave={onSave} onClose={onClose} />);

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement);
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ thinking: { type: 'disabled' } }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps boolean toggle values as booleans', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        specs={booleanSpecs}
        slotLabel="test-model"
        onSave={onSave}
      />
    ));

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement);
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ logprobs: false }));
  });

  it('includes applicable nested sibling defaults when saving a nested override', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        specs={anthropicSpecs}
        slotLabel="claude-sonnet-4-6"
        onSave={onSave}
      />
    ));

    fireEvent.click(screen.getByLabelText('Thinking mode'));
    fireEvent.click(screen.getByRole('option', { name: 'enabled' }));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        thinking: { type: 'enabled', budget_tokens: 4096 },
      }),
    );
  });

  it('disables controls when model-param availability rules make them unavailable', () => {
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        specs={anthropicSpecs}
        slotLabel="claude-sonnet-4-6"
        current={{ thinking: { type: 'adaptive' } }}
      />
    ));
    expect(screen.getByRole('slider', { name: 'Temperature' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('disables and skips conflicted params when another param is configured', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        specs={anthropicSpecs}
        slotLabel="claude-sonnet-4-6"
        current={{ temperature: 0.2, top_p: 0.7 }}
        onSave={onSave}
      />
    ));

    expect(screen.getByRole('slider', { name: 'Top P' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ temperature: 0.2 }));
  });

  it('does not persist nested defaults when only stale inapplicable nested values differ', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        specs={anthropicSpecs}
        slotLabel="claude-sonnet-4-6"
        current={{ thinking: { type: 'disabled', budget_tokens: 8192 } }}
        onSave={onSave}
      />
    ));

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('cancel button closes without persisting', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(() => <ModelParamsDialog {...baseProps} onSave={onSave} onClose={onClose} />);

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
});
