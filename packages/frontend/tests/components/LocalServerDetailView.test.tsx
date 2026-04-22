import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';

const { mockProbe, mockCreate, mockCheckHost, mockToast } = vi.hoisted(() => ({
  mockProbe: vi.fn(),
  mockCreate: vi.fn(),
  mockCheckHost: vi.fn().mockResolvedValue('localhost'),
  mockToast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../src/services/api.js', () => ({
  probeCustomProvider: (...a: unknown[]) => mockProbe(...a),
  createCustomProvider: (...a: unknown[]) => mockCreate(...a),
}));
vi.mock('../../src/services/setup-status.js', () => ({
  checkLocalLlmHost: () => mockCheckHost(),
}));
vi.mock('../../src/services/toast-store.js', () => ({
  toast: mockToast,
}));

import LocalServerDetailView from '../../src/components/LocalServerDetailView';
import type { ProviderDef } from '../../src/services/providers';

const lmsProv: ProviderDef = {
  id: 'lmstudio',
  name: 'LM Studio',
  color: '#4a90e2',
  initial: 'LM',
  subtitle: 'Run GGUF models with a local server',
  keyPrefix: '',
  minKeyLength: 0,
  keyPlaceholder: '',
  noKeyRequired: true,
  localOnly: true,
  models: [],
  defaultLocalPort: 1234,
};

describe('LocalServerDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckHost.mockResolvedValue('localhost');
  });

  it('probes on mount and confirms the server is reachable with the discovered model', async () => {
    mockProbe.mockResolvedValue({ models: [{ model_name: 'llama-3.1-8b' }] });

    const onConnected = vi.fn();
    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={onConnected}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(mockProbe).toHaveBeenCalledWith('a1', 'http://localhost:1234/v1');
      expect(container.textContent).toContain('Found 1 model');
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
        provider={lmsProv}
        onConnected={onConnected}
        onBack={vi.fn()}
      />
    ));

    const btn = await waitFor(() => {
      const b = Array.from(container.querySelectorAll('button')).find((x) =>
        x.textContent?.includes('Connect 1 model'),
      );
      if (!b) throw new Error('button not found yet');
      return b as HTMLButtonElement;
    });

    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('a1', {
        name: 'LM Studio',
        base_url: 'http://localhost:1234/v1',
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

  it('shows the failure state with setup command and a Retry button when probe fails', async () => {
    mockProbe.mockRejectedValue(new Error('No server is listening on http://localhost:1234/v1/models'));

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('No server is listening');
      expect(container.textContent).toContain('lms server start');
    });

    // Retry button is present; no escape hatch to a customize form.
    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry'),
    );
    expect(retryBtn).toBeDefined();
    expect(
      Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Customize'),
      ),
    ).toBeUndefined();
  });

  it('shows Docker caveat when running inside Docker', async () => {
    mockCheckHost.mockResolvedValue('host.docker.internal');
    mockProbe.mockRejectedValue(new Error('No server is listening'));

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('Running Manifest in Docker');
      expect(container.textContent).toContain('--bind 0.0.0.0');
    });
  });

  it('falls back to the letter badge when providerIcon has no entry for the id', async () => {
    mockProbe.mockResolvedValue({ models: [{ model_name: 'only' }] });
    const unknownProv: ProviderDef = {
      ...lmsProv,
      id: 'unknown-local-server',
      name: 'Unknown',
      initial: 'U',
      color: '#123456',
    };

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={unknownProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      const letter = container.querySelector('.provider-card__logo-letter');
      expect(letter?.textContent).toBe('U');
    });
  });

  it('renders a Retry button and a Docs link in the failure state, and retries the probe when clicked', async () => {
    // Default: reject — this is what the probe sees on mount.
    mockProbe.mockRejectedValue(new Error('No server is listening'));

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    const docsLink = await waitFor(() => {
      const a = container.querySelector<HTMLAnchorElement>('a.provider-detail__docs-link');
      if (!a) throw new Error('docs link not rendered yet');
      return a;
    });
    expect(docsLink.href).toContain('lmstudio.ai');
    expect(docsLink.target).toBe('_blank');
    expect(docsLink.rel).toContain('noopener');

    // Swap the mock so Retry succeeds — the component bumps refreshKey and re-runs the resource.
    mockProbe.mockResolvedValue({ models: [{ model_name: 'llama-3.1-8b' }] });
    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry'),
    ) as HTMLButtonElement;
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Found 1 model');
    });
    expect(mockProbe.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('refresh button re-probes and intersect-preserves the user selection', async () => {
    // Reset the mock state so no prior test's default leaks through; then
    // set an explicit default that is used for both the initial probe and
    // the post-click refetch until overridden below.
    mockProbe.mockReset();
    mockProbe.mockResolvedValue({
      models: [{ model_name: 'alpha' }, { model_name: 'beta' }],
    });

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    // Wait for initial probe to land.
    const boxes = await waitFor(() => {
      const list = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      if (list.length !== 2) throw new Error('waiting');
      return list;
    });
    // Uncheck the first ("alpha").
    fireEvent.click(boxes[0]);

    // Second probe returns an expanded list; "beta" stays (user still has it
    // checked), "gamma" appears unchecked, "alpha" is preserved as unchecked.
    mockProbe.mockReset();
    mockProbe.mockResolvedValue({
      models: [{ model_name: 'alpha' }, { model_name: 'beta' }, { model_name: 'gamma' }],
    });
    const refreshBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh model list"]',
    );
    expect(refreshBtn).not.toBeNull();
    fireEvent.click(refreshBtn!);

    await waitFor(() => {
      const rows = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      if (rows.length !== 3) throw new Error('waiting for 3 models');
      // alpha was unchecked before refresh and should stay unchecked.
      const labels = Array.from(
        container.querySelectorAll('.provider-detail__model-row'),
      ).map((row) => ({
        name: row.textContent?.trim() ?? '',
        checked: row.querySelector<HTMLInputElement>('input')?.checked ?? false,
      }));
      const alpha = labels.find((l) => l.name === 'alpha');
      const beta = labels.find((l) => l.name === 'beta');
      const gamma = labels.find((l) => l.name === 'gamma');
      expect(alpha?.checked).toBe(false);
      expect(beta?.checked).toBe(true);
      expect(gamma?.checked).toBe(false);
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
      />
    ));

    const boxes = await waitFor(() => {
      const list = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      if (list.length !== 2) throw new Error('waiting');
      return list;
    });

    // Uncheck then re-check the first — covers both branches of toggleModel.
    fireEvent.click(boxes[0]);
    expect(
      Array.from(container.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Connect 1 model'),
      ),
    ).toBe(true);

    fireEvent.click(boxes[0]);
    expect(
      Array.from(container.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Connect 2 models'),
      ),
    ).toBe(true);
  });

  it('surfaces a toast error when createCustomProvider rejects', async () => {
    mockProbe.mockResolvedValue({ models: [{ model_name: 'only' }] });
    mockCreate.mockRejectedValue(new Error('DB down'));

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    const btn = await waitFor(() => {
      const b = Array.from(container.querySelectorAll('button')).find((x) =>
        x.textContent?.includes('Connect 1 model'),
      );
      if (!b) throw new Error('not ready');
      return b as HTMLButtonElement;
    });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('DB down');
    });
  });

  it('copies the bind command from the Docker caveat when Copy is clicked', async () => {
    mockCheckHost.mockResolvedValue('host.docker.internal');
    mockProbe.mockRejectedValue(new Error('No server is listening'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    const copyBtn = await waitFor(() => {
      const candidates = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.provider-detail__caveat button'),
      );
      const b = candidates.find((el) => el.textContent?.trim() === 'Copy');
      if (!b) throw new Error('copy button not yet rendered');
      return b;
    });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('--bind 0.0.0.0'));
    });
    // Label flips to "Copied" briefly after a successful copy.
    expect(copyBtn.textContent?.trim()).toBe('Copied');
  });

  it('falls back to the error toast when Copy-in-caveat rejects', async () => {
    mockCheckHost.mockResolvedValue('host.docker.internal');
    mockProbe.mockRejectedValue(new Error('No server is listening'));
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    const copyBtn = await waitFor(() => {
      const candidates = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.provider-detail__caveat button'),
      );
      const b = candidates.find((el) => el.textContent?.trim() === 'Copy');
      if (!b) throw new Error('copy button not yet rendered');
      return b;
    });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Copy failed — select the command and copy it manually',
      );
    });
  });

  it('renders the GUI fix row and one-time-setup line for LM Studio in Docker', async () => {
    mockCheckHost.mockResolvedValue('host.docker.internal');
    mockProbe.mockRejectedValue(new Error('No server is listening'));

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      const caveat = container.querySelector('.provider-detail__caveat');
      expect(caveat).not.toBeNull();
      // GUI path (the "Fix it" GUI label) and the copyable CLI with --bind.
      expect(caveat!.textContent).toContain('Serve on Local Network');
      expect(caveat!.textContent).toContain('--bind 0.0.0.0');
      expect(caveat!.textContent).toContain('One-time setup');
    });
  });
});
