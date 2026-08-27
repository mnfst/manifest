import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

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

const mockToast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

const mockGetUsers = vi.fn();
const mockGetProjects = vi.fn();
const mockCheckAgentName = vi.fn();
const mockAssignNewAgent = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  checkAgentName: (...args: unknown[]) => mockCheckAgentName(...args),
  assignNewAgent: (...args: unknown[]) => mockAssignNewAgent(...args),
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

// Deployment mode drives the logs storage note in the toggle description.
let mockIsSelfHosted = false;
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => Promise.resolve(mockIsSelfHosted),
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
    mockIsSelfHosted = false;
    mockCreateAgent.mockResolvedValue({ agent: { name: 'new-agent' }, apiKey: 'key-1' });
    mockGetGlobalProviders.mockResolvedValue({ providers: [{ provider: 'openai' }] });
    mockGetUsers.mockResolvedValue({
      users: [
        { id: 'u-maya', name: 'Maya Okonkwo' },
        { id: 'u-tom', name: 'Tom Reyes' },
      ],
    });
    mockGetProjects.mockResolvedValue({
      projects: [
        { id: 'p-atlas', name: 'Atlas' },
        { id: 'p-hsbc', name: 'HSBC' },
      ],
    });
    mockCheckAgentName.mockResolvedValue({ available: true, suggestion: null });
    mockAssignNewAgent.mockResolvedValue(undefined);
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => <AddAgentModal open={false} onClose={() => {}} />);
    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('renders the dialog title and description when open', () => {
    const { container } = renderOpen();
    expect(container.textContent).toContain('New agent');
    expect(container.textContent).toContain('Name your agent to start tracking');
    expect(container.textContent).toContain("The owner's name never goes inside the agent name.");
  });

  describe('owner, projects and name uniqueness', () => {
    const openOwnerSelect = async () => {
      await vi.waitFor(() => expect(mockGetUsers).toHaveBeenCalled());
      fireEvent.click(screen.getByLabelText('Owner'));
      await vi.waitFor(() => expect(screen.queryByText('Maya Okonkwo')).not.toBeNull());
    };

    it('defaults to no owner and no projects, and sends them after a create', async () => {
      const { input, createBtn } = renderOpen();
      fireEvent.input(input, { target: { value: 'unowned' } });
      fireEvent.click(createBtn);
      await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      expect(mockAssignNewAgent).toHaveBeenCalledWith('new-agent', null, []);
    });

    it('lets the owner and projects be chosen and sends them after a create', async () => {
      const { input, createBtn } = renderOpen();
      await openOwnerSelect();
      fireEvent.click(screen.getByText('Maya Okonkwo'));
      await vi.waitFor(() => expect(mockGetProjects).toHaveBeenCalled());
      fireEvent.click(screen.getByLabelText('Projects'));
      await vi.waitFor(() => expect(screen.queryByText('Atlas')).not.toBeNull());
      fireEvent.click(screen.getByText('Atlas'));
      fireEvent.input(input, { target: { value: 'claude-code' } });
      fireEvent.click(createBtn);
      await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      expect(mockAssignNewAgent).toHaveBeenCalledWith('new-agent', 'u-maya', ['p-atlas']);
    });

    it('pre-fills the owner and projects from props and restores them on reset', async () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <AddAgentModal
          open={true}
          onClose={onClose}
          defaultOwnerId="u-tom"
          defaultProjectIds={['p-hsbc']}
        />
      ));
      await vi.waitFor(() => expect(container.textContent).toContain('Tom Reyes'));
      expect(container.textContent).toContain('HSBC');
      fireEvent.keyDown(container.querySelector('.modal-card')!, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('warns but still navigates when attaching owner and projects fails', async () => {
      mockAssignNewAgent.mockRejectedValue(new Error('boom'));
      const { input, createBtn } = renderOpen();
      fireEvent.input(input, { target: { value: 'x' } });
      fireEvent.click(createBtn);
      await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      expect(mockToast.warning).toHaveBeenCalledWith(
        expect.stringContaining('owner and projects could not be saved'),
      );
    });

    it('falls back to an empty list when users or projects fail to load', async () => {
      mockGetUsers.mockRejectedValue(new Error('boom'));
      mockGetProjects.mockRejectedValue(new Error('boom'));
      renderOpen();
      await vi.waitFor(() => expect(mockGetProjects).toHaveBeenCalled());
      fireEvent.click(screen.getByLabelText('Owner'));
      // Trigger label + the single option.
      expect(screen.getAllByText('No owner').length).toBe(2);
      expect(screen.queryByText('Maya Okonkwo')).toBeNull();
    });

    it('does not load users or projects while closed', () => {
      render(() => <AddAgentModal open={false} onClose={() => {}} />);
      expect(mockGetUsers).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    describe('debounced name check', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it('flags a taken name with a suggestion, blocks Create, and fills the suggestion', async () => {
        mockCheckAgentName.mockResolvedValue({ available: false, suggestion: 'claude-code-2' });
        const { container, input, createBtn } = renderOpen();
        fireEvent.input(input, { target: { value: 'claude-cod' } });
        fireEvent.input(input, { target: { value: 'claude-code' } });
        expect(mockCheckAgentName).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(300);
        await vi.waitFor(() => expect(mockCheckAgentName).toHaveBeenCalledTimes(1));
        expect(mockCheckAgentName).toHaveBeenCalledWith('claude-code', null);
        await vi.waitFor(() =>
          expect(container.textContent).toContain('claude-code is already taken for this owner.'),
        );
        expect((createBtn as HTMLButtonElement).disabled).toBe(true);
        expect(input.getAttribute('aria-invalid')).toBe('true');
        fireEvent.click(createBtn);
        expect(mockCreateAgent).not.toHaveBeenCalled();
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(mockCreateAgent).not.toHaveBeenCalled();

        mockCheckAgentName.mockResolvedValue({ available: true, suggestion: null });
        fireEvent.click(screen.getByText('Use claude-code-2'));
        expect(input.value).toBe('claude-code-2');
        await vi.advanceTimersByTimeAsync(300);
        await vi.waitFor(() => expect((createBtn as HTMLButtonElement).disabled).toBe(false));
      });

      it('re-checks against the chosen owner and shows no suggestion button when none is offered', async () => {
        mockCheckAgentName.mockResolvedValue({ available: false, suggestion: null });
        const { container, input } = renderOpen();
        await vi.advanceTimersByTimeAsync(0);
        fireEvent.click(screen.getByLabelText('Owner'));
        await vi.waitFor(() => expect(screen.queryByText('Tom Reyes')).not.toBeNull());
        fireEvent.click(screen.getByText('Tom Reyes'));
        fireEvent.input(input, { target: { value: 'claude-code' } });
        await vi.advanceTimersByTimeAsync(300);
        await vi.waitFor(() =>
          expect(mockCheckAgentName).toHaveBeenCalledWith('claude-code', 'u-tom'),
        );
        await vi.waitFor(() => expect(container.textContent).toContain('already taken'));
        expect(container.querySelector('.field__suggestion')).toBeNull();
      });

      it('treats a failed check as available and ignores a stale result', async () => {
        let resolveFirst: (v: unknown) => void = () => {};
        mockCheckAgentName
          .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
          .mockRejectedValueOnce(new Error('boom'));
        const { container, input, createBtn } = renderOpen();
        fireEvent.input(input, { target: { value: 'first' } });
        await vi.advanceTimersByTimeAsync(300);
        fireEvent.input(input, { target: { value: 'second' } });
        await vi.advanceTimersByTimeAsync(300);
        resolveFirst({ available: false, suggestion: 'first-2' });
        await vi.waitFor(() => expect(mockCheckAgentName).toHaveBeenCalledTimes(2));
        await vi.advanceTimersByTimeAsync(0);
        expect(container.textContent).not.toContain('already taken');
        expect((createBtn as HTMLButtonElement).disabled).toBe(false);
      });

      it('clears the check when the name is emptied', async () => {
        mockCheckAgentName.mockResolvedValue({ available: false, suggestion: 'x-2' });
        const { container, input } = renderOpen();
        fireEvent.input(input, { target: { value: 'x' } });
        await vi.advanceTimersByTimeAsync(300);
        await vi.waitFor(() => expect(container.textContent).toContain('already taken'));
        fireEvent.input(input, { target: { value: '' } });
        expect(container.textContent).not.toContain('already taken');
        await vi.advanceTimersByTimeAsync(300);
        expect(mockCheckAgentName).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('creates directly with the legal line as the consent act (no dialog)', async () => {
    const { input, createBtn } = renderOpen();
    // Autofix defaults on, so the Terms/Privacy legal line is visible.
    expect(document.body.textContent).toContain('you agree to Manifest');
    expect(document.querySelector('a[href="https://manifest.build/terms"]')).not.toBeNull();
    expect(document.querySelector('a[href="https://manifest.build/privacy"]')).not.toBeNull();

    fireEvent.input(input, { target: { value: 'first-agent' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());
    expect(screen.queryByText('Enable hosted Autofix?')).toBeNull();
  });

  it('hides the legal line when Autofix is toggled off and still creates', async () => {
    const { container, input, createBtn } = renderOpen();
    fireEvent.click(container.querySelector('.settings-switch')!);
    expect(document.body.textContent).not.toContain('you agree to Manifest');

    fireEvent.input(input, { target: { value: 'disabled-agent' } });
    fireEvent.click(createBtn);
    await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());
    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({ autofix_enabled: false }),
    );
  });

  describe('create races', () => {
    it('issues one create for rapid double submits', async () => {
      let resolveCreate!: (v: { agent: { name: string }; apiKey: string }) => void;
      mockCreateAgent.mockReturnValue(
        new Promise<{ agent: { name: string }; apiKey: string }>((r) => (resolveCreate = r)),
      );
      const { input, createBtn } = renderOpen();
      fireEvent.input(input, { target: { value: 'double-clicked' } });
      fireEvent.click(createBtn);
      fireEvent.click(createBtn);
      fireEvent.click(createBtn);

      resolveCreate({ agent: { name: 'double-clicked' }, apiKey: 'key-1' });
      await vi.waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());
      expect(mockCreateAgent).toHaveBeenCalledTimes(1);
    });

    it('does not navigate to the created agent if the modal is reopened mid-provider-lookup', async () => {
      // Models the real parent: <AddAgentModal open={signal()} onClose={...}>,
      // where closing does not unmount. The success path closes the modal and
      // *then* awaits getGlobalProviders, so a user who reopens to add a second
      // agent used to get redirected to the first one when that lookup landed.
      let resolveProviders!: (v: { providers: unknown[] }) => void;
      mockGetGlobalProviders.mockReturnValue(
        new Promise<{ providers: unknown[] }>((r) => (resolveProviders = r)),
      );
      const [open, setOpen] = createSignal(true);
      const { container } = render(() => (
        <AddAgentModal open={open()} onClose={() => setOpen(false)} />
      ));
      const input = container.querySelector('.modal-card__input') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'first-agent' } });
      fireEvent.click(screen.getByText('Create'));

      await vi.waitFor(() => expect(open()).toBe(false));
      setOpen(true); // user reopens to add another agent
      resolveProviders({ providers: [] });
      await Promise.resolve();
      await Promise.resolve();

      expect(mockNavigate).not.toHaveBeenCalled();
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
      expect(mockNavigate).toHaveBeenCalledWith('/agents/new-agent/routing', {
        state: { newApiKey: 'key-1' },
      });
    });
    expect(mockMarkAgentCreated).toHaveBeenCalledWith('new-agent');
    // Persistent flag set so the setup modal survives a refresh on landing.
    expect(mockMarkSetupPending).toHaveBeenCalledWith('new-agent');
    expect(onClose).toHaveBeenCalled();
  });

  it('refreshes the agent list as soon as creation succeeds', async () => {
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
      expect(mockNavigate).toHaveBeenCalledWith('/agents/new-agent/routing', {
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
      expect(mockNavigate).toHaveBeenCalledWith('/agents/new-agent/routing', {
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
      expect(mockNavigate).toHaveBeenCalledWith('/agents/new-agent/routing', {
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
        `/agents/${encodeURIComponent('Typed Name')}/routing`,
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

  it('sends toggled-off Autofix and recording when the user flips them', async () => {
    const { input, createBtn } = renderOpen();
    // Both switches default on; flip each off before creating.
    const switches = Array.from(
      document.querySelectorAll('.settings-switch'),
    ) as HTMLButtonElement[];
    // Order in the modal: Autofix, then Enable logs.
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

  it('labels the logs toggle and shows the cloud storage note', async () => {
    renderOpen();
    expect(screen.getByText('Enable logs')).toBeTruthy();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Logs are stored in your Manifest workspace.'),
    );
  });

  it('shows the machine-local storage note on self-hosted', async () => {
    mockIsSelfHosted = true;
    renderOpen();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Logs stay in your own database.'),
    );
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
      expect(mockNavigate).toHaveBeenCalledWith('/agents/new-agent/routing', {
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
