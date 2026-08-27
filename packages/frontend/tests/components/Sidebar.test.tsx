import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

let mockPathname = '/overview';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => {
    // Access classList to trigger coverage of classList expressions
    const cl = props.classList;
    const classes = [props.class || ''];
    if (cl) {
      for (const [key, val] of Object.entries(cl)) {
        if (val) classes.push(key);
      }
    }
    return (
      <a
        href={props.href}
        class={classes.join(' ').trim()}
        aria-current={props['aria-current']}
        onClick={props.onClick}
      >
        {props.children}
      </a>
    );
  },
  useLocation: () => ({
    get pathname() {
      return mockPathname;
    },
  }),
}));

// getAgents is only fetched when the Autofix modal opens, to resolve display
// names and icons for the uncovered agents. The sidebar keeps no agent list.
const mockGetAgents = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
}));

const mockGetBillingStatus = vi.fn();
vi.mock('../../src/services/api/billing.js', () => ({
  getBillingStatus: (...args: unknown[]) => mockGetBillingStatus(...args),
}));

// Workspace Autofix status drives the bottom-left card and the modal list.
const mockGetAutofixStatus = vi.fn();
vi.mock('../../src/services/api/analytics.js', () => ({
  getWorkspaceAutofixStatus: (...args: unknown[]) => mockGetAutofixStatus(...args),
}));

// Per-agent Autofix saves fired by the modal toggles.
const mockUpdateAutofix = vi.fn();
vi.mock('../../src/services/api/routing.js', () => ({
  updateAutofix: (...args: unknown[]) => mockUpdateAutofix(...args),
}));

// Local providers only exist on self-hosted installs; the Sidebar hides the
// Local nav entry in cloud. Default to self-hosted so the nine-entry
// assertions apply; cloud tests flip the flag.
let mockIsSelfHosted = true;
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => Promise.resolve(mockIsSelfHosted),
}));

import Sidebar, { SIDEBAR_NAV } from '../../src/components/Sidebar';

const SAMPLE_AGENTS = [
  {
    agent_name: 'alpha',
    display_name: 'Alpha Agent',
    agent_platform: 'openclaw',
    agent_category: 'personal',
  },
  {
    // No display_name → falls back to agent_name. No platform → no icon.
    agent_name: 'beta',
    agent_platform: null,
    agent_category: null,
  },
];

const NINE_ENTRIES = [
  '/overview',
  '/messages',
  '/users',
  '/agents',
  '/projects',
  '/providers/usage-based',
  '/providers/subscriptions',
  '/providers/local',
  '/playground',
];

beforeEach(() => {
  mockGetAutofixStatus.mockResolvedValue({
    any_enabled: false,
    enabled_agents: [],
    disabled_agents: ['alpha', 'beta'],
    needs_enable_all: true,
    consented: false,
  });
  sessionStorage.clear();
  vi.clearAllMocks();
  mockPathname = '/overview';
  mockIsSelfHosted = true;
  mockGetAgents.mockResolvedValue({ agents: SAMPLE_AGENTS });
  mockGetBillingStatus.mockResolvedValue({
    enabled: false,
    plan: 'free',
    requests: { used: null, limit: null, periodEnd: null },
  });
});

/** Waits for the async self-hosted resource so the Local link has settled. */
const settle = (container: HTMLElement) =>
  waitFor(() => expect(container.querySelector('a[href="/providers/local"]')).not.toBeNull());

describe('Sidebar — nine fixed entries', () => {
  it('declares exactly nine navigation entries in four groups', () => {
    const hrefs = SIDEBAR_NAV.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toEqual(NINE_ENTRIES);
    expect(SIDEBAR_NAV.map((group) => group.section)).toEqual([
      undefined,
      'MANAGE',
      'PROVIDERS',
      'TOOLS',
    ]);
  });

  it('renders the nine entries and nothing else as sidebar links', async () => {
    const { container } = render(() => <Sidebar />);
    await settle(container);
    const links = Array.from(container.querySelectorAll('a.sidebar__link')).map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual(NINE_ENTRIES);
  });

  it('renders the MANAGE, PROVIDERS and TOOLS section labels with their entries', () => {
    render(() => <Sidebar />);
    expect(screen.getByText('MANAGE')).toBeDefined();
    expect(screen.getByText('Users')).toBeDefined();
    expect(screen.getByText('Agents')).toBeDefined();
    expect(screen.getByText('Projects')).toBeDefined();
    expect(screen.getByText('PROVIDERS')).toBeDefined();
    expect(screen.getByText('Usage-based')).toBeDefined();
    expect(screen.getByText('Subscriptions')).toBeDefined();
    expect(screen.getByText('TOOLS')).toBeDefined();
    expect(screen.getByText('Playground')).toBeDefined();
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Requests')).toBeDefined();
  });

  it('hides the Local link in cloud', async () => {
    mockIsSelfHosted = false;
    const { container } = render(() => <Sidebar />);
    await waitFor(() => expect(screen.getByText('Usage-based')).toBeDefined());
    await Promise.resolve();
    expect(container.querySelector('a[href="/providers/local"]')).toBeNull();
    expect(container.textContent).not.toContain('Local');
  });

  it('never lists agents, never fetches them for navigation, and shows no counts', async () => {
    const { container } = render(() => <Sidebar />);
    await settle(container);
    expect(container.querySelector('.sidebar__agents-list')).toBeNull();
    expect(container.querySelector('a.sidebar__agent-item')).toBeNull();
    expect(container.querySelector('.sidebar__section-add')).toBeNull();
    expect(container.querySelector('.sidebar__section-caret')).toBeNull();
    expect(container.textContent).not.toContain('Alpha Agent');
    expect(mockGetAgents).not.toHaveBeenCalled();
  });
});

describe('Sidebar — active state', () => {
  it('marks Overview active only on exact /overview path', () => {
    const { container } = render(() => <Sidebar />);
    const link = container.querySelector('a[href="/overview"]');
    expect(link?.getAttribute('aria-current')).toBe('page');
  });

  it('marks Requests active on /messages and not Overview', () => {
    mockPathname = '/messages';
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/messages"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(container.querySelector('a[href="/overview"]')?.getAttribute('aria-current')).not.toBe(
      'page',
    );
  });

  it("keeps Agents active on an agent's detail page (prefix match)", () => {
    mockPathname = '/agents/alpha/routing';
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/agents"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('keeps Users and Projects active on their detail pages', () => {
    mockPathname = '/users/u-maya/agents';
    let view = render(() => <Sidebar />);
    expect(view.container.querySelector('a[href="/users"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    view.unmount();
    mockPathname = '/projects/p-hsbc';
    view = render(() => <Sidebar />);
    expect(view.container.querySelector('a[href="/projects"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('marks provider links active on provider pages', async () => {
    mockPathname = '/providers/local';
    const { container } = render(() => <Sidebar />);
    await waitFor(() => {
      const link = container.querySelector('a[href="/providers/local"]');
      expect(link?.getAttribute('aria-current')).toBe('page');
    });
    expect(
      container.querySelector('a[href="/providers/usage-based"]')?.getAttribute('aria-current'),
    ).not.toBe('page');
  });

  it('marks Playground active on /playground', () => {
    mockPathname = '/playground';
    const { container } = render(() => <Sidebar />);
    expect(container.querySelector('a[href="/playground"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
  });
});

describe('Sidebar — structure and interaction', () => {
  it('has nav element with aria-label', () => {
    const { container } = render(() => <Sidebar />);
    const nav = container.querySelector('nav.sidebar');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Navigation');
  });

  it('applies the mobile open class', () => {
    const { container } = render(() => <Sidebar mobileOpen />);
    const nav = container.querySelector('nav.sidebar');
    expect(nav?.classList.contains('sidebar--mobile-open')).toBe(true);
  });

  it('calls onNavigate when a sidebar link is clicked', async () => {
    const onNavigate = vi.fn();
    const { container } = render(() => <Sidebar onNavigate={onNavigate} />);
    const link = container.querySelector('a.sidebar__link');

    expect(link).not.toBeNull();
    link!.addEventListener('click', (event) => event.preventDefault(), { once: true });

    await fireEvent.click(link!);

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not call onNavigate for clicks outside links', async () => {
    const onNavigate = vi.fn();
    const { container } = render(() => <Sidebar onNavigate={onNavigate} />);
    await fireEvent.click(container.querySelector('.sidebar__spacer')!);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('Sidebar — Autofix card', () => {
  it('shows the card with the Enable button while some agents lack Autofix', async () => {
    const { container } = render(() => <Sidebar />);
    await screen.findByText('Keep your agents reliable');
    expect(container.querySelector('.sidebar-autofix')).not.toBeNull();
    expect(container.textContent).toContain('Enable it to repair eligible failing requests');
    const btn = container.querySelector('button.sidebar-autofix__btn') as HTMLButtonElement;
    expect(btn?.textContent).toBe('Enable');
  });

  it('shows the card in cloud too', async () => {
    mockIsSelfHosted = false;
    const { container } = render(() => <Sidebar />);
    await screen.findByText('Keep your agents reliable');
    expect(container.querySelector('button.sidebar-autofix__btn')).not.toBeNull();
  });

  it('hides the card when the status fetch fails (fail-soft fallback)', async () => {
    mockGetAutofixStatus.mockRejectedValue(new Error('boom'));
    const { container } = render(() => <Sidebar />);
    await settle(container);
    await waitFor(() => expect(mockGetAutofixStatus).toHaveBeenCalled());
    expect(container.querySelector('.sidebar-autofix')).toBeNull();
  });

  it('hides the card entirely once every agent has Autofix', async () => {
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: true,
      enabled_agents: ['alpha', 'beta'],
      disabled_agents: [],
      needs_enable_all: false,
      consented: true,
    });
    const { container } = render(() => <Sidebar />);
    await settle(container);
    expect(container.querySelector('.sidebar-autofix')).toBeNull();
  });

  it('keeps the card with coverage copy while only some agents are enabled', async () => {
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: true,
      enabled_agents: ['alpha'],
      disabled_agents: ['beta'],
      needs_enable_all: false,
      consented: true,
    });
    const { container } = render(() => <Sidebar />);
    await screen.findByText('Keep your agents reliable');
    expect(container.textContent).toContain('At least one of your agents runs without Autofix.');
    expect(container.querySelector('button.sidebar-autofix__btn')).not.toBeNull();
  });

  it('dismisses the card for the session via the close button', async () => {
    const { container, unmount } = render(() => <Sidebar />);
    await screen.findByText('Keep your agents reliable');

    fireEvent.click(container.querySelector('button.sidebar-autofix__dismiss')!);
    expect(container.querySelector('.sidebar-autofix')).toBeNull();
    expect(sessionStorage.getItem('autofix-card-dismissed')).toBe('1');
    unmount();

    // A remount within the same session stays dismissed.
    const second = render(() => <Sidebar />);
    await settle(second.container);
    expect(second.container.querySelector('.sidebar-autofix')).toBeNull();
    second.unmount();

    // A fresh session (cleared sessionStorage) brings the card back.
    sessionStorage.clear();
    const third = render(() => <Sidebar />);
    await waitFor(() => expect(third.container.querySelector('.sidebar-autofix')).not.toBeNull());
  });

  it('closes the modal via Done, overlay, and Escape without saving anything', async () => {
    const { container } = render(() => <Sidebar />);
    await screen.findByText('Keep your agents reliable');
    const open = () => fireEvent.click(container.querySelector('button.sidebar-autofix__btn')!);

    open();
    await screen.findByText('Enable Autofix');
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Enable Autofix')).toBeNull();

    open();
    await screen.findByText('Enable Autofix');
    const overlay = document.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(screen.queryByText('Enable Autofix')).toBeNull();

    open();
    await screen.findByText('Enable Autofix');
    fireEvent.keyDown(document.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(screen.queryByText('Enable Autofix')).toBeNull();

    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it('always opens the modal from Enable, even when the install already consented', async () => {
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: false,
      enabled_agents: [],
      disabled_agents: ['alpha', 'beta'],
      needs_enable_all: true,
      consented: true,
    });
    const { container } = render(() => <Sidebar />);
    await screen.findByText('Enable');
    fireEvent.click(container.querySelector('button.sidebar-autofix__btn')!);
    await screen.findByText('Enable Autofix');
    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it('polls the status so a toggle made elsewhere hides the card', async () => {
    // Autofix toggles emit no SSE event, so the card relies on the 15s poll
    // to notice a change made from the Settings page.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockGetAutofixStatus
        .mockResolvedValueOnce({
          any_enabled: false,
          enabled_agents: [],
          disabled_agents: ['alpha'],
          needs_enable_all: true,
          consented: false,
        })
        .mockResolvedValue({
          any_enabled: true,
          enabled_agents: ['alpha'],
          disabled_agents: [],
          needs_enable_all: false,
          consented: true,
        });
      const { container } = render(() => <Sidebar />);
      await screen.findByText('Keep your agents reliable');
      await vi.advanceTimersByTimeAsync(15_000);
      await waitFor(() => expect(container.querySelector('.sidebar-autofix')).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the last known status when a poll tick fails', async () => {
    // A network blip on a refetch must not blank a known-good status: the
    // card would flicker off for a tick. Only the first load falls back empty.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockGetAutofixStatus
        .mockResolvedValueOnce({
          any_enabled: false,
          enabled_agents: [],
          disabled_agents: ['alpha'],
          needs_enable_all: true,
          consented: false,
        })
        .mockRejectedValue(new Error('blip'));
      const { container } = render(() => <Sidebar />);
      await screen.findByText('Keep your agents reliable');
      await vi.advanceTimersByTimeAsync(15_000);
      await waitFor(() => expect(mockGetAutofixStatus.mock.calls.length).toBeGreaterThan(1));
      expect(container.querySelector('.sidebar-autofix')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Sidebar — Autofix per-agent modal', () => {
  const openModal = async (container: HTMLElement) => {
    await screen.findByText('Keep your agents reliable');
    fireEvent.click(container.querySelector('button.sidebar-autofix__btn')!);
    await screen.findByText('Enable Autofix');
  };
  const switches = () =>
    Array.from(document.querySelectorAll('.autofix-consent__agent-row .settings-switch'));

  it('fetches the agent list on open (playground excluded) to resolve names and icons', async () => {
    const { container } = render(() => <Sidebar />);
    await openModal(container);
    // Default invocation = playground agents excluded (getAgents(false)).
    expect(mockGetAgents).toHaveBeenCalledTimes(1);
    expect(mockGetAgents).toHaveBeenCalledWith();

    const rows = document.querySelectorAll('.autofix-consent__agent-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Alpha Agent');
    expect(rows[0].querySelector('img.autofix-consent__agent-icon')).not.toBeNull();
    expect(rows[1].textContent).toContain('beta');
    expect(rows[1].querySelector('img.autofix-consent__agent-icon')).toBeNull();
    for (const sw of switches()) {
      expect(sw.getAttribute('aria-checked')).toBe('false');
    }
    expect(document.body.textContent).toContain('Autofix works per agent');
    expect(document.body.textContent).toContain("you agree to Manifest's");
  });

  it('resolves a bare array response (no { agents } wrapper)', async () => {
    mockGetAgents.mockResolvedValue(SAMPLE_AGENTS);
    const { container } = render(() => <Sidebar />);
    await openModal(container);
    expect(document.querySelectorAll('.autofix-consent__agent-row')[0].textContent).toContain(
      'Alpha Agent',
    );
  });

  it('falls back to raw agent names when the agent list fails or is null', async () => {
    mockGetAgents.mockRejectedValueOnce(new Error('boom'));
    const first = render(() => <Sidebar />);
    await openModal(first.container);
    expect(document.querySelectorAll('.autofix-consent__agent-row')[0].textContent).toContain(
      'alpha',
    );
    fireEvent.click(screen.getByText('Done'));
    first.unmount();

    mockGetAgents.mockResolvedValueOnce(null);
    const second = render(() => <Sidebar />);
    await openModal(second.container);
    expect(document.querySelectorAll('.autofix-consent__agent-row')[0].textContent).toContain(
      'alpha',
    );
  });

  it('saves a toggle immediately and flips the switch on', async () => {
    mockUpdateAutofix.mockResolvedValue({ enabled: true, consented: true });
    const { container } = render(() => <Sidebar />);
    await openModal(container);

    fireEvent.click(switches()[0]);
    expect(mockUpdateAutofix).toHaveBeenCalledWith('alpha', { enabled: true });
    await waitFor(() => expect(switches()[0].getAttribute('aria-checked')).toBe('true'));
  });

  it('lets other toggles fire while a save is still in flight', async () => {
    let resolveFirst!: (v: unknown) => void;
    mockUpdateAutofix
      .mockReturnValueOnce(new Promise((res) => (resolveFirst = res)))
      .mockResolvedValueOnce({ enabled: true, consented: true });
    const { container } = render(() => <Sidebar />);
    await openModal(container);

    fireEvent.click(switches()[0]);
    fireEvent.click(switches()[1]);
    // Both saves fired without waiting for each other, both rows optimistic on.
    expect(mockUpdateAutofix).toHaveBeenCalledTimes(2);
    expect(mockUpdateAutofix).toHaveBeenNthCalledWith(1, 'alpha', { enabled: true });
    expect(mockUpdateAutofix).toHaveBeenNthCalledWith(2, 'beta', { enabled: true });
    expect(switches()[0].getAttribute('aria-checked')).toBe('true');
    expect(switches()[1].getAttribute('aria-checked')).toBe('true');
    resolveFirst({ enabled: true, consented: true });
  });

  it('ignores repeat clicks on a row while its own save is in flight', async () => {
    // The switch stays focusable during a save (aria-disabled, not disabled,
    // so the modal's focus trap keeps working) — the re-entry guard is JS.
    let resolveFirst!: (v: unknown) => void;
    mockUpdateAutofix.mockReturnValueOnce(new Promise((res) => (resolveFirst = res)));
    const { container } = render(() => <Sidebar />);
    await openModal(container);

    fireEvent.click(switches()[0]);
    expect(switches()[0].getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(switches()[0]);
    expect(mockUpdateAutofix).toHaveBeenCalledTimes(1);
    resolveFirst({ enabled: true, consented: true });
    await waitFor(() => expect(switches()[0].getAttribute('aria-disabled')).toBe('false'));
  });

  it('reverts a row when its save fails', async () => {
    mockUpdateAutofix.mockRejectedValue(new Error('boom'));
    const { container } = render(() => <Sidebar />);
    await openModal(container);

    fireEvent.click(switches()[0]);
    expect(switches()[0].getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(switches()[0].getAttribute('aria-checked')).toBe('false'));
  });

  it('saves a toggle back off and keeps the row listed', async () => {
    mockUpdateAutofix.mockResolvedValue({ enabled: true, consented: true });
    const { container } = render(() => <Sidebar />);
    await openModal(container);

    fireEvent.click(switches()[0]);
    await waitFor(() => expect(switches()[0].getAttribute('aria-checked')).toBe('true'));

    mockUpdateAutofix.mockResolvedValue({ enabled: false, consented: true });
    fireEvent.click(switches()[0]);
    expect(mockUpdateAutofix).toHaveBeenLastCalledWith('alpha', { enabled: false });
    await waitFor(() => expect(switches()[0].getAttribute('aria-checked')).toBe('false'));
    expect(document.querySelectorAll('.autofix-consent__agent-row').length).toBe(2);
  });

  it('hides the sidebar card once every agent is covered, while the modal stays open', async () => {
    mockUpdateAutofix.mockResolvedValue({ enabled: true, consented: true });
    const { container } = render(() => <Sidebar />);
    await openModal(container);

    fireEvent.click(switches()[0]);
    fireEvent.click(switches()[1]);
    await waitFor(() => expect(container.querySelector('.sidebar-autofix')).toBeNull());
    // The modal itself stays open until Done.
    expect(screen.queryByText('Enable Autofix')).not.toBeNull();
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Enable Autofix')).toBeNull();
  });

  it('falls back to the raw agent name for an agent the list does not know', async () => {
    mockGetAutofixStatus.mockResolvedValue({
      any_enabled: false,
      enabled_agents: [],
      disabled_agents: ['ghost'],
      needs_enable_all: true,
      consented: false,
    });
    mockGetAgents.mockResolvedValue({ agents: [] });
    const { container } = render(() => <Sidebar />);
    await openModal(container);
    const rows = document.querySelectorAll('.autofix-consent__agent-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('ghost');
    expect(rows[0].querySelector('img.autofix-consent__agent-icon')).toBeNull();
  });
});

describe('Sidebar — usage card', () => {
  beforeEach(() => {
    // The usage meter only occupies the bottom-left slot in cloud; self-hosted
    // always shows the Autofix card there.
    mockIsSelfHosted = false;
  });
  afterEach(() => {
    mockIsSelfHosted = true;
  });

  it('renders free-plan usage and the near-limit warning state', async () => {
    mockGetBillingStatus.mockResolvedValue({
      enabled: true,
      plan: 'free',
      requests: { used: 8_500, limit: 10_000, periodEnd: null },
    });

    const { container } = render(() => <Sidebar />);

    await screen.findByText(/8,500/);
    expect(container.querySelector('.sidebar-usage__count--danger')).not.toBeNull();
    expect(container.querySelector('.sidebar-usage__fill--danger')).not.toBeNull();
    expect(container.textContent).toContain(
      "You're limited to 10,000 requests this month. Upgrade for unlimited.",
    );
    expect(container.querySelector('a[href="/upgrade"]')).not.toBeNull();
  });

  it('renders the reached-limit warning state', async () => {
    mockGetBillingStatus.mockResolvedValue({
      enabled: true,
      plan: 'free',
      requests: { used: 10_001, limit: 10_000, periodEnd: null },
    });

    const { container } = render(() => <Sidebar />);

    await screen.findByText(/10,001/);
    expect(container.textContent).toContain(
      "You've reached your monthly limit. Requests are being blocked.",
    );
    expect(container.querySelector('.sidebar-usage__fill--danger')).not.toBeNull();
  });

  it('renders null counts as zero', async () => {
    mockGetBillingStatus.mockResolvedValue({
      enabled: true,
      plan: 'free',
      requests: { used: null, limit: null, periodEnd: null },
    });
    const { container } = render(() => <Sidebar />);
    await waitFor(() => expect(container.querySelector('.sidebar-usage')).not.toBeNull());
    expect(container.querySelector('.sidebar-usage__count')?.textContent).toContain('0 / 0');
  });

  it('hides the usage card when the billing fetch fails (fail-soft fallback)', async () => {
    mockGetBillingStatus.mockRejectedValue(new Error('boom'));
    const { container } = render(() => <Sidebar />);
    await waitFor(() => expect(mockGetBillingStatus).toHaveBeenCalled());
    await Promise.resolve();
    expect(container.querySelector('.sidebar-usage')).toBeNull();
  });

  it('renders the warning fill before the danger threshold', async () => {
    mockGetBillingStatus.mockResolvedValue({
      enabled: true,
      plan: 'free',
      requests: { used: 5_500, limit: 10_000, periodEnd: null },
    });

    const { container } = render(() => <Sidebar />);

    await screen.findByText(/5,500/);
    expect(container.querySelector('.sidebar-usage__fill--warning')).not.toBeNull();
    expect(container.querySelector('.sidebar-usage__fill--danger')).toBeNull();
  });

  it('calls onNavigate when the upgrade link is clicked', async () => {
    mockGetBillingStatus.mockResolvedValue({
      enabled: true,
      plan: 'free',
      requests: { used: 10, limit: 10_000, periodEnd: null },
    });
    const onNavigate = vi.fn();
    const { container } = render(() => <Sidebar onNavigate={onNavigate} />);
    await waitFor(() => expect(container.querySelector('a[href="/upgrade"]')).not.toBeNull());
    const link = container.querySelector('a[href="/upgrade"]')!;
    link.addEventListener('click', (event) => event.preventDefault(), { once: true });
    await fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalled();
  });
});
