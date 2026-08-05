import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockCreateAgent = vi.fn();
const mockGetGlobalProviders = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  createAgent: (...args: unknown[]) => mockCreateAgent(...args),
  getGlobalProviders: (...args: unknown[]) => mockGetGlobalProviders(...args),
}));

const mockGetWorkspaceAutofixStatus = vi.fn();
vi.mock('../../src/services/api/analytics.js', () => ({
  getWorkspaceAutofixStatus: (...args: unknown[]) => mockGetWorkspaceAutofixStatus(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const mockMarkAgentCreated = vi.fn();
const mockMarkSetupPending = vi.fn();
vi.mock('../../src/services/recent-agents.js', () => ({
  markAgentCreated: (...args: unknown[]) => mockMarkAgentCreated(...args),
  markSetupPending: (...args: unknown[]) => mockMarkSetupPending(...args),
}));

const mockRefreshAgents = vi.fn();
vi.mock('../../src/services/sse.js', () => ({
  refreshAgents: (...args: unknown[]) => mockRefreshAgents(...args),
}));

vi.mock('../../src/components/AgentTypeSelect.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="agent-type-picker"
      data-category={props.category ?? ''}
      data-platform={props.platform ?? ''}
      data-disabled={String(!!props.disabled)}
    >
      <button data-testid="pick-app" onClick={() => props.onCategoryChange('app')}>
        App
      </button>
      <button data-testid="pick-platform" onClick={() => props.onPlatformChange('langchain')}>
        P
      </button>
    </div>
  ),
}));

vi.mock('manifest-shared', () => ({
  PLATFORMS_BY_CATEGORY: {
    personal: ['openclaw', 'hermes', 'other'],
    app: ['openai-sdk', 'vercel-ai-sdk', 'langchain', 'other'],
    coding: ['claude-code', 'other'],
  },
}));

import AddAgentModal from '../../src/components/AddAgentModal';

const renderOpen = () => {
  const onClose = vi.fn();
  const result = render(() => <AddAgentModal open={true} onClose={onClose} />);
  const input = result.container.querySelector('.modal-card__input') as HTMLInputElement;
  const createBtn = screen.getByText('Create');
  return { ...result, onClose, input, createBtn };
};

describe('AddAgentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAgent.mockResolvedValue({ agent: { name: 'new-agent' }, apiKey: 'key-1' });
    mockGetGlobalProviders.mockResolvedValue({ providers: [{ provider: 'openai' }] });
    mockGetWorkspaceAutofixStatus.mockResolvedValue({ consented: true });
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => <AddAgentModal open={false} onClose={() => {}} />);
    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('renders the dialog title and description when open', () => {
    const { container } = renderOpen();
    expect(container.textContent).toContain('Connect Harness');
    expect(container.textContent).toContain('Name your harness to start tracking');
  });

  it('asks for consent before creating the first Auto-fix-enabled agent', async () => {
    mockGetWorkspaceAutofixStatus.mockResolvedValue({ consented: false });
    const { input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'first-agent' } });
    fireEvent.click(createBtn);

    await screen.findByText('Enable hosted Auto-fix?');
    expect(mockCreateAgent).not.toHaveBeenCalled();
    expect(screen.getByText(/Provider authorization credentials are not sent/)).toBeDefined();
    expect(document.querySelector('a[href="https://manifest.build/terms"]')).not.toBeNull();
    expect(document.querySelector('a[href="https://manifest.build/privacy"]')).not.toBeNull();

    fireEvent.click(screen.getByText('Agree & create'));
    await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());
  });

  it('creates without consent when Auto-fix is explicitly disabled', async () => {
    mockGetWorkspaceAutofixStatus.mockResolvedValue({ consented: false });
    const { container, input, createBtn } = renderOpen();
    fireEvent.click(container.querySelector('.settings-switch')!);
    fireEvent.input(input, { target: { value: 'disabled-agent' } });
    fireEvent.click(createBtn);

    await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());
    expect(screen.queryByText('Enable hosted Auto-fix?')).toBeNull();
    expect(mockGetWorkspaceAutofixStatus).not.toHaveBeenCalled();
  });

  it('returns to the create dialog when first-use consent is cancelled', async () => {
    mockGetWorkspaceAutofixStatus.mockResolvedValue({ consented: false });
    const { container, input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'first-agent' } });
    fireEvent.click(createBtn);

    await screen.findByText('Enable hosted Auto-fix?');
    expect(container.querySelector('.modal-card')?.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Enable hosted Auto-fix?')).toBeNull();
    expect(screen.getByText('Connect Harness')).toBeDefined();
    expect(container.querySelector('.modal-card')?.getAttribute('aria-hidden')).toBeNull();
    expect(mockCreateAgent).not.toHaveBeenCalled();
  });

  describe('consent-lookup races', () => {
    /** Consent lookup the test resolves by hand, to hold the async gap open. */
    const pendingConsent = () => {
      let resolve!: (v: { consented: boolean }) => void;
      mockGetWorkspaceAutofixStatus.mockReturnValue(
        new Promise<{ consented: boolean }>((r) => (resolve = r)),
      );
      return { resolve };
    };

    it('does not create or navigate when the modal is dismissed mid-lookup', async () => {
      // The parent keeps <AddAgentModal> mounted and toggles `open`, so state
      // survives a dismissal. Reopening and typing a new name is what makes the
      // abandoned lookup dangerous: `createAgentNow` reset the dismissal flag,
      // so the stale resolution created a harness from whatever was in the box
      // and navigated away. (Dismissing alone was masked by resetForm clearing
      // the name into createAgentNow's empty-name guard — not a real defence.)
      const { resolve } = pendingConsent();
      const { container, input, createBtn } = renderOpen();
      fireEvent.input(input, { target: { value: 'abandoned-agent' } });
      fireEvent.click(createBtn);

      fireEvent.click(container.querySelector('.modal-overlay')!);
      // User reopens and starts over while the first lookup is still pending.
      fireEvent.input(input, { target: { value: 'second-thoughts' } });
      resolve({ consented: true });
      await Promise.resolve();
      await Promise.resolve();

      expect(mockCreateAgent).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not queue the consent dialog for the next open after a mid-lookup dismissal', async () => {
      const { resolve } = pendingConsent();
      const { container, input, createBtn } = renderOpen();
      fireEvent.input(input, { target: { value: 'abandoned-agent' } });
      fireEvent.click(createBtn);

      fireEvent.click(container.querySelector('.modal-overlay')!);
      resolve({ consented: false });
      await Promise.resolve();
      await Promise.resolve();

      expect(screen.queryByText('Enable hosted Auto-fix?')).toBeNull();
    });

    it('issues one create for rapid double submits', async () => {
      const { resolve } = pendingConsent();
      const { input, createBtn } = renderOpen();
      fireEvent.input(input, { target: { value: 'double-clicked' } });
      fireEvent.click(createBtn);
      fireEvent.click(createBtn);
      fireEvent.click(createBtn);

      resolve({ consented: true });
      await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());

      expect(mockCreateAgent).toHaveBeenCalledTimes(1);
      expect(mockGetWorkspaceAutofixStatus).toHaveBeenCalledTimes(1);
    });

    it('locks the form while the consent lookup is in flight', () => {
      pendingConsent();
      const { container, input, createBtn } = renderOpen();
      fireEvent.input(input, { target: { value: 'locked' } });
      fireEvent.click(createBtn);

      expect((createBtn as HTMLButtonElement).disabled).toBe(true);
      expect(input.disabled).toBe(true);
      for (const sw of container.querySelectorAll<HTMLButtonElement>('.settings-switch')) {
        expect(sw.disabled).toBe(true);
      }
    });

    it('creates with the Auto-fix choice the consent dialog was shown for', async () => {
      // The user cannot flip the toggle mid-lookup (it is disabled), but the
      // choice is pinned at submit regardless, so the created harness always
      // matches what the dialog promised.
      const { resolve } = pendingConsent();
      const { input, createBtn } = renderOpen();
      fireEvent.input(input, { target: { value: 'consented-agent' } });
      fireEvent.click(createBtn);
      resolve({ consented: false });

      await screen.findByText('Enable hosted Auto-fix?');
      fireEvent.click(screen.getByText('Agree & create'));

      await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({ autofix_enabled: true }),
      );
    });
  });

  it('keeps Create disabled until a non-blank name is entered', () => {
    const { input, createBtn } = renderOpen();
    expect((createBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.input(input, { target: { value: '  ' } });
    expect((createBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.input(input, { target: { value: 'x' } });
    expect((createBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not submit when name is whitespace only', () => {
    const { input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: '   ' } });
    fireEvent.click(createBtn);
    expect(mockCreateAgent).not.toHaveBeenCalled();
  });

  it('navigates with newApiKey only when the tenant already has providers', async () => {
    mockGetGlobalProviders.mockResolvedValue({ providers: [{ provider: 'openai' }] });
    const { input, createBtn, onClose } = renderOpen();
    fireEvent.input(input, { target: { value: 'agent-a' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/harnesses/new-agent/routing', {
        state: { newApiKey: 'key-1' },
      });
    });
    expect(mockMarkAgentCreated).toHaveBeenCalledWith('new-agent');
    // Persistent flag set so the setup modal survives a refresh on landing.
    expect(mockMarkSetupPending).toHaveBeenCalledWith('new-agent');
    expect(onClose).toHaveBeenCalled();
  });

  it('refreshes the harness list as soon as creation succeeds', async () => {
    const { input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'agent-a' } });
    fireEvent.click(createBtn);

    await vi.waitFor(() => {
      expect(mockRefreshAgents).toHaveBeenCalledTimes(1);
    });
  });

  it('adds openProviders when the tenant has no providers yet', async () => {
    mockGetGlobalProviders.mockResolvedValue({ providers: [] });
    const { input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'agent-b' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/harnesses/new-agent/routing', {
        state: { newApiKey: 'key-1', openProviders: true },
      });
    });
  });

  it('treats a missing providers array as no providers', async () => {
    mockGetGlobalProviders.mockResolvedValue({});
    const { input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'agent-c' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/harnesses/new-agent/routing', {
        state: { newApiKey: 'key-1', openProviders: true },
      });
    });
  });

  it('falls back to openProviders when the providers lookup throws', async () => {
    mockGetGlobalProviders.mockRejectedValue(new Error('network'));
    const { input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'agent-d' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/harnesses/new-agent/routing', {
        state: { newApiKey: 'key-1', openProviders: true },
      });
    });
  });

  it('falls back to the typed name when the server omits the slug', async () => {
    mockCreateAgent.mockResolvedValue({ apiKey: 'k' });
    const { input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'Typed Name' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockMarkAgentCreated).toHaveBeenCalledWith('Typed Name');
      expect(mockMarkSetupPending).toHaveBeenCalledWith('Typed Name');
      expect(mockNavigate).toHaveBeenCalledWith(
        `/harnesses/${encodeURIComponent('Typed Name')}/routing`,
        expect.anything(),
      );
    });
  });

  it('sends the selected category and platform in the createAgent payload', async () => {
    const { container, input, createBtn } = renderOpen();
    fireEvent.click(container.querySelector('[data-testid="pick-app"]')!);
    fireEvent.click(container.querySelector('[data-testid="pick-platform"]')!);
    fireEvent.input(input, { target: { value: 'typed' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith({
        name: 'typed',
        agent_category: 'app',
        agent_platform: 'langchain',
        autofix_enabled: true,
        record_messages: true,
      });
    });
  });

  it('sends toggled-off Auto-fix and recording when the user flips them', async () => {
    const { input, createBtn } = renderOpen();
    // Both switches default on; flip each off before creating.
    const switches = Array.from(
      document.querySelectorAll('.settings-switch'),
    ) as HTMLButtonElement[];
    // Order in the modal: Auto-fix, then Record messages.
    expect(switches.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(switches[0]!);
    fireEvent.click(switches[1]!);
    fireEvent.input(input, { target: { value: 'typed' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith({
        name: 'typed',
        agent_category: 'personal',
        agent_platform: expect.any(String),
        autofix_enabled: false,
        record_messages: false,
      });
    });
  });

  it('resets the category/platform to defaults when a category changes', () => {
    const { container } = renderOpen();
    // Switch to app (platform becomes openai-sdk, first of app list).
    fireEvent.click(container.querySelector('[data-testid="pick-app"]')!);
    const picker = container.querySelector('[data-testid="agent-type-picker"]')!;
    expect(picker.getAttribute('data-category')).toBe('app');
    expect(picker.getAttribute('data-platform')).toBe('openai-sdk');
  });

  it('disables the input and shows a spinner while creating', async () => {
    let resolveCreate: (v: unknown) => void;
    mockCreateAgent.mockReturnValue(
      new Promise((r) => {
        resolveCreate = r;
      }),
    );
    const { container, input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'slow' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(input.disabled).toBe(true);
      expect(container.querySelector('.spinner')).not.toBeNull();
    });
    resolveCreate!({ agent: { name: 'slow' }, apiKey: 'k' });
  });

  it('does not navigate after the create resolves if the modal was dismissed mid-request (overlay)', async () => {
    let resolveCreate: (v: unknown) => void;
    mockCreateAgent.mockReturnValue(
      new Promise((r) => {
        resolveCreate = r;
      }),
    );
    const { container, input } = renderOpen();
    fireEvent.input(input, { target: { value: 'dismissed' } });
    fireEvent.click(screen.getByText('Create'));
    await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());

    // User dismisses the modal (overlay click) while the request is still pending.
    fireEvent.click(container.querySelector('.modal-overlay')!);

    // Now the in-flight request resolves — the post-success side effects and the
    // navigation must be skipped because the user already dismissed the modal.
    resolveCreate!({ agent: { name: 'dismissed' }, apiKey: 'k' });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockMarkAgentCreated).not.toHaveBeenCalled();
    expect(mockMarkSetupPending).not.toHaveBeenCalled();
    expect(mockGetGlobalProviders).not.toHaveBeenCalled();
  });

  it('does not navigate after the create resolves if the modal was dismissed mid-request (Escape)', async () => {
    let resolveCreate: (v: unknown) => void;
    mockCreateAgent.mockReturnValue(
      new Promise((r) => {
        resolveCreate = r;
      }),
    );
    const { input } = renderOpen();
    fireEvent.input(input, { target: { value: 'esc-dismissed' } });
    fireEvent.click(screen.getByText('Create'));
    await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());

    // Escape dismisses the modal while the create is still pending.
    fireEvent.keyDown(input, { key: 'Escape' });

    resolveCreate!({ agent: { name: 'esc-dismissed' }, apiKey: 'k' });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockMarkAgentCreated).not.toHaveBeenCalled();
    expect(mockMarkSetupPending).not.toHaveBeenCalled();
  });

  it('does not navigate if dismissed during the providers lookup', async () => {
    let resolveProviders: (v: unknown) => void;
    mockGetGlobalProviders.mockReturnValue(
      new Promise((r) => {
        resolveProviders = r;
      }),
    );
    const { container, input } = renderOpen();
    fireEvent.input(input, { target: { value: 'late-dismiss' } });
    fireEvent.click(screen.getByText('Create'));

    // createAgent resolves first (it ran the success side effects), then the
    // providers lookup is in flight when the user dismisses the modal.
    await vi.waitFor(() => expect(mockGetGlobalProviders).toHaveBeenCalled());
    // Default mock returns agent.name "new-agent" as the slug.
    expect(mockMarkAgentCreated).toHaveBeenCalledWith('new-agent');

    fireEvent.click(container.querySelector('.modal-overlay')!);
    resolveProviders!({ providers: [{ provider: 'openai' }] });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('still navigates on a normal (non-dismissed) successful create', async () => {
    // Guards against the dismissal flag wrongly suppressing a clean success: a
    // second create after a prior dismissal must reset the flag and navigate.
    const { input } = renderOpen();
    fireEvent.input(input, { target: { value: 'clean' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.input(input, { target: { value: 'clean' } });
    fireEvent.click(screen.getByText('Create'));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/harnesses/new-agent/routing', {
        state: { newApiKey: 'key-1' },
      });
    });
  });

  it('does not navigate or mark created when createAgent rejects', async () => {
    mockCreateAgent.mockRejectedValue(new Error('boom'));
    const { input, createBtn } = renderOpen();
    fireEvent.input(input, { target: { value: 'fails' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalled();
    });
    expect(mockMarkAgentCreated).not.toHaveBeenCalled();
    expect(mockMarkSetupPending).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('creates the agent on Enter from the name input', async () => {
    const { input } = renderOpen();
    fireEvent.input(input, { target: { value: 'enter-agent' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await vi.waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'enter-agent' }),
      );
    });
  });

  it('does not create on Enter when focus is not the name input', () => {
    const { container, input } = renderOpen();
    fireEvent.input(input, { target: { value: 'x' } });
    // Enter dispatched on the dialog (not an input element) is ignored.
    fireEvent.keyDown(container.querySelector('.modal-card')!, { key: 'Enter' });
    expect(mockCreateAgent).not.toHaveBeenCalled();
  });

  it('closes and resets the form on Escape', () => {
    const { container, input, onClose } = renderOpen();
    fireEvent.input(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes and resets the form on overlay click', () => {
    const { container, onClose } = renderOpen();
    const overlay = container.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when the modal card itself is clicked', () => {
    const { container, onClose } = renderOpen();
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
