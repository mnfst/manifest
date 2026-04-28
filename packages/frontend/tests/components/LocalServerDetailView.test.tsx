import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';

const { mockProbe, mockCreate, mockDelete, mockUpdate, mockCheckHost, mockToast } = vi.hoisted(
  () => ({
    mockProbe: vi.fn(),
    mockCreate: vi.fn(),
    mockDelete: vi.fn(),
    mockUpdate: vi.fn(),
    mockCheckHost: vi.fn().mockResolvedValue('localhost'),
    mockToast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  }),
);

vi.mock('../../src/services/api.js', () => ({
  probeCustomProvider: (...a: unknown[]) => mockProbe(...a),
  createCustomProvider: (...a: unknown[]) => mockCreate(...a),
  deleteCustomProvider: (...a: unknown[]) => mockDelete(...a),
  updateCustomProvider: (...a: unknown[]) => mockUpdate(...a),
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

const llamacppProv: ProviderDef = {
  id: 'llamacpp',
  name: 'llama.cpp',
  color: '#2d2d2d',
  initial: 'Lc',
  subtitle: 'OpenAI-compatible server for GGUF models on CPU / Metal / CUDA',
  keyPrefix: '',
  minKeyLength: 0,
  keyPlaceholder: '',
  noKeyRequired: true,
  localOnly: true,
  models: [],
  defaultLocalPort: 8080,
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
      expect(container.textContent).toContain('1 model');
      expect(container.textContent).toContain('llama-3.1-8b');
    });
  });

  it('renders a toggle list when LM Studio returns multiple models', async () => {
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
      const toggles = container.querySelectorAll('.provider-toggle');
      expect(toggles.length).toBe(3);
      // All enabled (on) by default
      const switches = container.querySelectorAll('.provider-toggle__switch--on');
      expect(switches.length).toBe(3);
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
      // CLI tab must be clicked to see the bind command
      expect(container.textContent).toContain('GUI');
      expect(container.textContent).toContain('CLI');
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
      const a = container.querySelector<HTMLAnchorElement>('a.btn--outline');
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
      expect(container.textContent).toContain('1 model');
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
    const toggles = await waitFor(() => {
      const list = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.provider-toggle'),
      );
      if (list.length !== 2) throw new Error('waiting');
      return list;
    });
    // Toggle off the first ("alpha").
    fireEvent.click(toggles[0]);

    // Second probe returns an expanded list; "beta" stays (user still has it
    // on), "gamma" appears off, "alpha" is preserved as off.
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
        container.querySelectorAll<HTMLButtonElement>('.provider-toggle'),
      );
      if (rows.length !== 3) throw new Error('waiting for 3 models');
      // alpha was toggled off before refresh and should stay off.
      const labels = rows.map((row) => ({
        name: row.textContent?.trim() ?? '',
        on: !!row.querySelector('.provider-toggle__switch--on'),
      }));
      const alpha = labels.find((l) => l.name === 'alpha');
      const beta = labels.find((l) => l.name === 'beta');
      const gamma = labels.find((l) => l.name === 'gamma');
      expect(alpha?.on).toBe(false);
      expect(beta?.on).toBe(true);
      expect(gamma?.on).toBe(false);
    });
  });

  it('toggles model selection on toggle click', async () => {
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

    const toggles = await waitFor(() => {
      const list = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.provider-toggle'),
      );
      if (list.length !== 2) throw new Error('waiting');
      return list;
    });

    // Toggle off then back on the first — covers both branches of toggleModel.
    fireEvent.click(toggles[0]);
    expect(
      Array.from(container.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Connect 1 model'),
      ),
    ).toBe(true);

    fireEvent.click(toggles[0]);
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

    // Switch to CLI tab to reveal the copy button
    const cliTab = await waitFor(() => {
      const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.provider-detail__caveat button'));
      const t = tabs.find((el) => el.textContent?.trim() === 'CLI');
      if (!t) throw new Error('CLI tab not yet rendered');
      return t;
    });
    fireEvent.click(cliTab);

    const copyBtn = await waitFor(() => {
      const candidates = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.provider-detail__caveat button'),
      );
      const b = candidates.find((el) => el.title === 'Copy' || el.title === 'Copied!');
      if (!b) throw new Error('copy button not yet rendered');
      return b;
    });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('--bind 0.0.0.0'));
    });
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

    // Switch to CLI tab to reveal the copy button
    const cliTab = await waitFor(() => {
      const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.provider-detail__caveat button'));
      const t = tabs.find((el) => el.textContent?.trim() === 'CLI');
      if (!t) throw new Error('CLI tab not yet rendered');
      return t;
    });
    fireEvent.click(cliTab);

    const copyBtn = await waitFor(() => {
      const candidates = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.provider-detail__caveat button'),
      );
      const b = candidates.find((el) => el.title === 'Copy' || el.title === 'Copied!');
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

  it('opens in edit mode with pre-selected models and calls updateCustomProvider on save', async () => {
    mockProbe.mockResolvedValue({
      models: [{ model_name: 'alpha' }, { model_name: 'beta' }, { model_name: 'gamma' }],
    });
    mockUpdate.mockResolvedValue({});
    const onConnected = vi.fn();

    const editData = {
      id: 'cp-42',
      name: 'LM Studio',
      base_url: 'http://localhost:1234/v1',
      models: [
        { model_name: 'alpha', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 },
        { model_name: 'beta', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 },
      ],
    };

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        editData={editData}
        onConnected={onConnected}
        onBack={vi.fn()}
      />
    ));

    // Wait for probe and verify edit mode title
    await waitFor(() => {
      expect(container.textContent).toContain('Edit provider');
    });

    // Button says "Save changes" in edit mode
    const saveBtn = await waitFor(() => {
      const b = Array.from(container.querySelectorAll('button')).find((x) =>
        x.textContent?.includes('Save changes'),
      );
      if (!b) throw new Error('save button not found yet');
      return b as HTMLButtonElement;
    });

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('a1', 'cp-42', {
        models: expect.arrayContaining([
          expect.objectContaining({ model_name: 'alpha' }),
          expect.objectContaining({ model_name: 'beta' }),
        ]),
      });
      expect(onConnected).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('updated'));
    });
  });

  it('calls deleteCustomProvider when Delete button is clicked in edit mode', async () => {
    mockProbe.mockResolvedValue({
      models: [{ model_name: 'alpha' }],
    });
    mockDelete.mockResolvedValue({});
    const onConnected = vi.fn();

    const editData = {
      id: 'cp-99',
      name: 'LM Studio',
      base_url: 'http://localhost:1234/v1',
      models: [
        { model_name: 'alpha', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 },
      ],
    };

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        editData={editData}
        onConnected={onConnected}
        onBack={vi.fn()}
      />
    ));

    const deleteBtn = await waitFor(() => {
      const b = Array.from(container.querySelectorAll('button')).find((x) =>
        x.textContent?.includes('Delete provider'),
      );
      if (!b) throw new Error('delete button not found yet');
      return b as HTMLButtonElement;
    });

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('a1', 'cp-99');
      expect(onConnected).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('disconnected'));
    });
  });

  it('shows toast error when delete fails', async () => {
    mockProbe.mockResolvedValue({
      models: [{ model_name: 'alpha' }],
    });
    mockDelete.mockRejectedValue(new Error('delete failed'));

    const editData = {
      id: 'cp-99',
      name: 'LM Studio',
      base_url: 'http://localhost:1234/v1',
      models: [
        { model_name: 'alpha', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 },
      ],
    };

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        editData={editData}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    const deleteBtn = await waitFor(() => {
      const b = Array.from(container.querySelectorAll('button')).find((x) =>
        x.textContent?.includes('Delete provider'),
      );
      if (!b) throw new Error('delete button not found yet');
      return b as HTMLButtonElement;
    });

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('delete failed');
    });
  });

  it('shows empty models state when server is reachable but returns no models', async () => {
    mockProbe.mockResolvedValue({ models: [] });

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('no models are loaded');
      expect(container.textContent).toContain('Retry');
    });
  });

  it('shows error toast when probe fails in edit mode (server was connected)', async () => {
    mockProbe.mockRejectedValue(new Error('Connection lost'));

    const editData = {
      id: 'cp-1',
      name: 'LM Studio',
      base_url: 'http://localhost:1234/v1',
      models: [
        { model_name: 'alpha', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 },
      ],
    };

    render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={lmsProv}
        editData={editData}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('LM Studio is no longer reachable');
    });
  });

  it('copies setup command when copy button is clicked in failure state', async () => {
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

    // Wait for the setup command copy button (inside the setup cmd block, not Docker caveat)
    const copyBtn = await waitFor(() => {
      // The copy button is a button with a title attribute
      const candidates = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[title]'),
      );
      const b = candidates.find((el) => el.title === 'Copy' || el.title === 'Copied!');
      if (!b) throw new Error('copy button not yet rendered');
      return b;
    });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('lms server start');
    });
  });

  it('shows toast error when setup command copy fails', async () => {
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
        container.querySelectorAll<HTMLButtonElement>('button[title]'),
      );
      const b = candidates.find((el) => el.title === 'Copy' || el.title === 'Copied!');
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

  it('renders the llama.cpp notReachableHint with a clickable "Add custom provider" link in FailureState', async () => {
    mockProbe.mockRejectedValue(new Error('returned 404'));
    const onOpenCustomForm = vi.fn();

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={llamacppProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
        onOpenCustomForm={onOpenCustomForm}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('llama-server');
      expect(container.textContent).toContain('--port 8080');
      expect(container.textContent).toContain('Recent llama.cpp builds expose /v1/models');
    });

    const linkBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Add custom provider',
    );
    expect(linkBtn).toBeDefined();
    fireEvent.click(linkBtn!);
    expect(onOpenCustomForm).toHaveBeenCalled();
  });

  it('renders the notReachableHint link as a static span when no onOpenCustomForm callback is wired', async () => {
    mockProbe.mockRejectedValue(new Error('returned 404'));

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={llamacppProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('Recent llama.cpp builds expose /v1/models');
    });

    // No <button>Add custom provider</button>, but the label still renders
    // inline so the hint is readable without a dead link.
    const linkBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Add custom provider',
    );
    expect(linkBtn).toBeUndefined();
    expect(container.textContent).toContain('Add custom provider');
  });

  it('does NOT render the LM-Studio GUI fallback copy when the provider is llama.cpp', async () => {
    mockProbe.mockRejectedValue(new Error('No server is listening'));

    const { container } = render(() => (
      <LocalServerDetailView
        agentName="a1"
        provider={llamacppProv}
        onConnected={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('<your-model>.gguf');
    });
    expect(container.textContent).not.toContain('Developer → Start Server');
    expect(container.querySelector('video')).toBeNull();
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
      // GUI tab is active by default — shows the GUI fix text.
      expect(caveat!.textContent).toContain('Serve on Local Network');
      expect(caveat!.textContent).toContain('You only need to do this once');
    });

    // Switch to CLI tab and verify the bind command is shown.
    const cliTab = Array.from(container.querySelectorAll<HTMLButtonElement>('.provider-detail__caveat button'))
      .find((el) => el.textContent?.trim() === 'CLI')!;
    fireEvent.click(cliTab);

    await waitFor(() => {
      expect(container.querySelector('.provider-detail__caveat')!.textContent).toContain('--bind 0.0.0.0');
    });
  });
});
