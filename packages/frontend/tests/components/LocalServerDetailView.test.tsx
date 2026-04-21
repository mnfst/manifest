import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';

const { mockProbe, mockCreate, mockCheckHost } = vi.hoisted(() => ({
  mockProbe: vi.fn(),
  mockCreate: vi.fn(),
  mockCheckHost: vi.fn().mockResolvedValue('localhost'),
}));

vi.mock('../../src/services/api.js', () => ({
  probeCustomProvider: (...a: unknown[]) => mockProbe(...a),
  createCustomProvider: (...a: unknown[]) => mockCreate(...a),
}));
vi.mock('../../src/services/setup-status.js', () => ({
  checkLocalLlmHost: () => mockCheckHost(),
}));
vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import LocalServerDetailView from '../../src/components/LocalServerDetailView';
import type { ProviderDef } from '../../src/services/providers';

const vllmProv: ProviderDef = {
  id: 'vllm',
  name: 'vLLM',
  color: '#306998',
  initial: 'vL',
  subtitle: 'High-throughput GPU inference server',
  keyPrefix: '',
  minKeyLength: 0,
  keyPlaceholder: '',
  noKeyRequired: true,
  localOnly: true,
  models: [],
  defaultLocalPort: 8000,
};

const lmsProv: ProviderDef = {
  ...vllmProv,
  id: 'lmstudio',
  name: 'LM Studio',
  subtitle: 'Run GGUF models with a local server',
  defaultLocalPort: 1234,
};

describe('LocalServerDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckHost.mockResolvedValue('localhost');
  });

  it('probes on mount and renders a single-model confirmation for vLLM', async () => {
    mockProbe.mockResolvedValue({ models: [{ model_name: 'llama-3.1-8b' }] });

    const onConnected = vi.fn();
    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={vllmProv}
        onConnected={onConnected}
        onBack={vi.fn()}
        onCustomize={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(mockProbe).toHaveBeenCalledWith('a1', 'http://localhost:8000/v1');
      expect(container.textContent).toContain('Server is reachable');
      expect(container.textContent).toContain('llama-3.1-8b');
    });
  });

  it('renders a checklist when LM Studio returns multiple models', async () => {
    mockProbe.mockResolvedValue({
      models: [{ model_name: 'm-a' }, { model_name: 'm-b' }, { model_name: 'm-c' }],
    });

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
        onCustomize={vi.fn()}
      />
    ));

    await waitFor(() => {
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
      // All checked by default
      for (const cb of Array.from(checkboxes) as HTMLInputElement[]) {
        expect(cb.checked).toBe(true);
      }
    });
  });

  it('creates a custom provider via createCustomProvider on Connect with zero pricing', async () => {
    mockProbe.mockResolvedValue({ models: [{ model_name: 'single' }] });
    mockCreate.mockResolvedValue({ id: 'cp-1' });
    const onConnected = vi.fn();

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={vllmProv}
        onConnected={onConnected}
        onBack={vi.fn()}
        onCustomize={vi.fn()}
      />
    ));

    const btn = await waitFor(() => {
      const b = Array.from(container.querySelectorAll('button')).find((x) =>
        x.textContent?.includes('Connect vLLM'),
      );
      if (!b) throw new Error('button not found yet');
      return b as HTMLButtonElement;
    });

    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('a1', {
        name: 'vLLM',
        base_url: 'http://localhost:8000/v1',
        models: [
          {
            model_name: 'single',
            input_price_per_million_tokens: 0,
            output_price_per_million_tokens: 0,
          },
        ],
      });
      expect(onConnected).toHaveBeenCalled();
    });
  });

  it('shows the failure state with setup command and Retry / Customize when probe fails', async () => {
    mockProbe.mockRejectedValue(new Error('No server is listening on http://localhost:8000/v1/models'));
    const onCustomize = vi.fn();

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={vllmProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
        onCustomize={onCustomize}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('No server is listening');
      expect(container.textContent).toContain('vllm serve');
    });

    // Customize dispatches back to the parent with current URL
    const customizeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Customize URL'),
    ) as HTMLButtonElement;
    fireEvent.click(customizeBtn);
    expect(onCustomize).toHaveBeenCalledWith({
      name: 'vLLM',
      baseUrl: 'http://localhost:8000/v1',
    });
  });

  it('shows Docker caveat when running inside Docker', async () => {
    mockCheckHost.mockResolvedValue('host.docker.internal');
    mockProbe.mockRejectedValue(new Error('No server is listening'));

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={vllmProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
        onCustomize={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('Running Manifest in Docker');
      expect(container.textContent).toContain('--host 0.0.0.0');
    });
  });

  it('toggles model selection on checkbox click', async () => {
    mockProbe.mockResolvedValue({
      models: [{ model_name: 'a' }, { model_name: 'b' }],
    });
    mockCreate.mockResolvedValue({ id: 'cp-1' });

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
        onCustomize={vi.fn()}
      />
    ));

    const boxes = await waitFor(() => {
      const list = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      if (list.length !== 2) throw new Error('waiting');
      return list;
    });

    // Uncheck first
    fireEvent.click(boxes[0]);
    const connectBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Connect 1 model'),
    );
    expect(connectBtn).toBeDefined();
  });
});
