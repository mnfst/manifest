import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

vi.mock('../../src/services/providers.js', () => ({
  STAGES: [
    { id: 'simple', label: 'Simple' },
    { id: 'standard', label: 'Standard' },
    { id: 'complex', label: 'Complex' },
  ],
  DEFAULT_STAGE: { id: 'default', label: 'Default' },
}));

import ResponseModeModal from '../../src/components/ResponseModeModal';
import type { AvailableModel, TierAssignment } from '../../src/services/api/routing';

const streamCapableModel: AvailableModel = {
  model_name: 'gpt-4o',
  provider: 'OpenAI',
  auth_type: 'api_key',
  input_price_per_token: 0.000005,
  output_price_per_token: 0.000015,
  context_window: 128000,
  capability_reasoning: false,
  capability_code: true,
  capabilities: ['text', 'stream'],
  quality_score: 8,
  display_name: 'GPT-4o',
};

const noStreamModel: AvailableModel = {
  model_name: 'o1-preview',
  provider: 'OpenAI',
  auth_type: 'api_key',
  input_price_per_token: 0.00001,
  output_price_per_token: 0.00003,
  context_window: 128000,
  capability_reasoning: true,
  capability_code: true,
  capabilities: ['text'],
  quality_score: 9,
  display_name: 'o1-preview',
};

const allStreamModels: AvailableModel[] = [streamCapableModel];
const mixedModels: AvailableModel[] = [streamCapableModel, noStreamModel];

function makeTier(overrides?: Partial<TierAssignment>): TierAssignment {
  return {
    id: 't1',
    agent_id: 'a1',
    tier: 'simple',
    override_route: null,
    auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
    fallback_routes: null,
    updated_at: '2025-01-01',
    ...overrides,
  };
}

describe('ResponseModeModal', () => {
  it('renders with stream mode off (buffered) and shows buffered description', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[makeTier()]}
        models={allStreamModels}
        onClose={vi.fn()}
      />
    ));
    expect(container.textContent).toContain(
      'Responses are returned as a single payload once the model finishes generating',
    );
    const toggle = container.querySelector('.routing-switch') as HTMLButtonElement;
    expect(toggle.classList.contains('routing-switch--on')).toBe(false);
  });

  it('renders with stream mode on and shows stream description', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('stream');
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[makeTier()]}
        models={allStreamModels}
        onClose={vi.fn()}
      />
    ));
    expect(container.textContent).toContain(
      'Responses are streamed token by token as the model generates them',
    );
    const toggle = container.querySelector('.routing-switch') as HTMLButtonElement;
    expect(toggle.classList.contains('routing-switch--on')).toBe(true);
  });

  it('toggle calls onResponseModeChange with stream when no incompatible models', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const onChange = vi.fn();
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={onChange}
        tiers={[makeTier()]}
        models={allStreamModels}
        onClose={vi.fn()}
      />
    ));
    const toggle = container.querySelector('.routing-switch') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith('stream');
  });

  it('toggle calls onResponseModeChange with buffered when currently streaming', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('stream');
    const onChange = vi.fn();
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={onChange}
        tiers={[makeTier()]}
        models={allStreamModels}
        onClose={vi.fn()}
      />
    ));
    const toggle = container.querySelector('.routing-switch') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith('buffered');
  });

  it('toggle is disabled when incompatible models exist and mode is buffered', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const onChange = vi.fn();
    const tier = makeTier({
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'o1-preview' },
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={onChange}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
      />
    ));
    const toggle = container.querySelector('.routing-switch') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.classList.contains('routing-switch--disabled')).toBe(true);
    fireEvent.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggle is disabled when disabled prop is true', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const [disabled] = createSignal(true);
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        disabled={disabled}
        tiers={[makeTier()]}
        models={allStreamModels}
        onClose={vi.fn()}
      />
    ));
    const toggle = container.querySelector('.routing-switch') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
  });

  it('lists incompatible models with model name, tier label, and position', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const tier = makeTier({
      tier: 'simple',
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'o1-preview' },
      fallback_routes: [{ provider: 'openai', authType: 'api_key', model: 'o1-preview' }],
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
      />
    ));
    const rows = container.querySelectorAll('.response-mode-modal__blocker-row');
    expect(rows.length).toBe(2);

    // Primary model
    const firstModel = rows[0].querySelector('.response-mode-modal__blocker-model');
    const firstMeta = rows[0].querySelector('.response-mode-modal__blocker-meta');
    expect(firstModel?.textContent).toBe('o1-preview');
    expect(firstMeta?.textContent).toContain('Simple');
    expect(firstMeta?.textContent).toContain('Primary');

    // Fallback model
    const secondMeta = rows[1].querySelector('.response-mode-modal__blocker-meta');
    expect(secondMeta?.textContent).toContain('Fallback 1');
  });

  it('shows singular copy when exactly one model is incompatible', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const tier = makeTier({
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'o1-preview' },
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
      />
    ));
    expect(container.textContent).toContain('this model does');
    expect(container.textContent).toContain('Change it to enable');
  });

  it('shows plural copy when multiple models are incompatible', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const tier = makeTier({
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'o1-preview' },
      fallback_routes: [{ provider: 'openai', authType: 'api_key', model: 'o1-preview' }],
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
      />
    ));
    expect(container.textContent).toContain('these models do');
    expect(container.textContent).toContain('Change them to enable');
  });

  it('Change button calls onReplace with tier, primary position, and stream capability', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const onReplace = vi.fn();
    const tier = makeTier({
      tier: 'complex',
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'o1-preview' },
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
        onReplace={onReplace}
      />
    ));
    const changeBtn = container.querySelector(
      '.response-mode-modal__blocker-row .btn--outline',
    ) as HTMLButtonElement;
    fireEvent.click(changeBtn);
    expect(onReplace).toHaveBeenCalledWith('complex', 'primary', 'stream');
  });

  it('Change button calls onReplace with fallback index for fallback models', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const onReplace = vi.fn();
    const tier = makeTier({
      tier: 'simple',
      override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
      auto_assigned_route: null,
      fallback_routes: [{ provider: 'openai', authType: 'api_key', model: 'o1-preview' }],
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
        onReplace={onReplace}
      />
    ));
    const changeBtn = container.querySelector(
      '.response-mode-modal__blocker-row .btn--outline',
    ) as HTMLButtonElement;
    fireEvent.click(changeBtn);
    // Fallback 1 → index 0
    expect(onReplace).toHaveBeenCalledWith('simple', 0, 'stream');
  });

  it('close button calls onClose', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const onClose = vi.fn();
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[]}
        models={[]}
        onClose={onClose}
      />
    ));
    const closeBtn = container.querySelector('.modal__close') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('overlay click calls onClose', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const onClose = vi.fn();
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[]}
        models={[]}
        onClose={onClose}
      />
    ));
    fireEvent.click(container.querySelector('.modal-overlay') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the modal card does not call onClose', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const onClose = vi.fn();
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[]}
        models={[]}
        onClose={onClose}
      />
    ));
    fireEvent.click(container.querySelector('.response-mode-modal') as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape key on overlay calls onClose', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const onClose = vi.fn();
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[]}
        models={[]}
        onClose={onClose}
      />
    ));
    fireEvent.keyDown(container.querySelector('.modal-overlay') as HTMLElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses override_route when present instead of auto_assigned_route', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const tier = makeTier({
      override_route: { provider: 'openai', authType: 'api_key', model: 'o1-preview' },
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
      />
    ));
    // o1-preview (override) should be listed as incompatible, not gpt-4o (auto)
    const modelNames = container.querySelectorAll('.response-mode-modal__blocker-model');
    expect(modelNames.length).toBe(1);
    expect(modelNames[0].textContent).toBe('o1-preview');
  });

  it('does not show blocker section when in stream mode even if models lack streaming', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('stream');
    const tier = makeTier({
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'o1-preview' },
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
      />
    ));
    expect(container.querySelector('.response-mode-modal__blocker')).toBeNull();
  });

  it('falls back to tier id when tier does not match any stage', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const tier = makeTier({
      tier: 'unknown-tier',
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'o1-preview' },
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={mixedModels}
        onClose={vi.fn()}
      />
    ));
    const meta = container.querySelector('.response-mode-modal__blocker-meta');
    expect(meta?.textContent).toContain('unknown-tier');
  });

  it('treats models without capabilities metadata as not supporting stream', () => {
    const [mode] = createSignal<'buffered' | 'stream'>('buffered');
    const noCapsModel: AvailableModel = {
      ...noStreamModel,
      model_name: 'mystery-model',
      capabilities: undefined,
    };
    const tier = makeTier({
      auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'mystery-model' },
    });
    const { container } = render(() => (
      <ResponseModeModal
        responseMode={mode}
        onResponseModeChange={vi.fn()}
        tiers={[tier]}
        models={[noCapsModel]}
        onClose={vi.fn()}
      />
    ));
    // Model without capabilities → hasStream returns false (via ?? false) → listed as incompatible
    const modelNames = container.querySelectorAll('.response-mode-modal__blocker-model');
    expect(modelNames.length).toBe(1);
    expect(modelNames[0].textContent).toBe('mystery-model');
  });
});
