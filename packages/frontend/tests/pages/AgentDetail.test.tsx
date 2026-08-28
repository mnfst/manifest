import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@solidjs/testing-library';

// Hoisted mutable state so individual tests can override pathname
let mockPathname = '/agents/my-agent';
const mockParams = { agentName: 'my-agent' };

vi.mock('@solidjs/router', () => ({
  useParams: () => mockParams,
  useLocation: () => ({ pathname: mockPathname }),
  A: (props: any) => (
    <a
      href={props.href}
      role={props.role}
      aria-selected={props['aria-selected']}
      class={[
        props.class,
        ...Object.entries(props.classList ?? {})
          .filter(([, on]) => on)
          .map(([name]) => name),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {props.children}
    </a>
  ),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
}));

vi.mock('../../src/services/agent-platform-store.js', () => ({
  agentPlatformIcon: () => undefined,
}));

// Default: no resolved display name (falls back to decoded slug)
let mockAgentDisplayName: string | null = null;
vi.mock('../../src/services/agent-display-name.js', () => ({
  agentDisplayName: () => mockAgentDisplayName,
}));

type Team = {
  owner: { id: string; name: string } | null;
  projects: Array<{ id: string; name: string; archived_at?: string | null }>;
  archived_at: string | null;
};
let mockTeam: Team = { owner: null, projects: [], archived_at: null };
const mockGetAgentTeam = vi.fn(async () => mockTeam);
vi.mock('../../src/services/api/teams.js', () => ({
  getAgentTeam: (...args: unknown[]) => mockGetAgentTeam(...args),
}));

vi.mock('../../src/services/sse.js', () => ({
  routingPing: () => 0,
}));

// The editor is exercised in its own test; here it only reports a change.
vi.mock('../../src/components/AgentProjectsEditor.jsx', () => ({
  default: (props: any) => (
    <>
      <button
        type="button"
        data-testid="agent-projects-editor"
        data-agent={props.agentName}
        onClick={() =>
          props.onChange([...props.projects, { id: 'p-new', name: 'New' }], props.agentName)
        }
      >
        + Project
      </button>
      <button
        type="button"
        data-testid="agent-projects-editor-stale"
        onClick={() => props.onChange([{ id: 'p-stale', name: 'Stale' }], 'someone-else')}
      >
        stale
      </button>
    </>
  ),
}));

import AgentDetail from '../../src/pages/AgentDetail';

describe('AgentDetail', () => {
  beforeEach(() => {
    mockPathname = '/agents/my-agent';
    mockParams.agentName = 'my-agent';
    mockAgentDisplayName = null;
    mockTeam = { owner: null, projects: [], archived_at: null };
    mockGetAgentTeam.mockClear();
  });

  it('renders the page title with the agent name', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('title')?.textContent).toBe('my-agent | Manifest');
  });

  it("shows the owner chip as a link to the user's page and the project tags", async () => {
    mockTeam = {
      owner: { id: 'u-maya', name: 'Maya Okonkwo' },
      projects: [
        { id: 'p-atlas', name: 'Atlas' },
        { id: 'p-old', name: 'Old', archived_at: '2026-08-01T00:00:00Z' },
      ],
      archived_at: '2026-08-02T00:00:00Z',
    };
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    await vi.waitFor(() => {
      expect(container.querySelector('a[href="/users/u-maya"]')?.textContent).toContain(
        'Maya Okonkwo',
      );
    });
    const tags = container.querySelectorAll('a.project-tag');
    expect(tags.length).toBe(2);
    expect(tags[0].getAttribute('href')).toBe('/projects/p-atlas');
    expect(tags[1].classList.contains('project-tag--archived')).toBe(true);
    expect(container.textContent).toContain('Archived');
    expect(container.querySelector('[data-testid="agent-projects-editor"]')).not.toBeNull();
  });

  it("shows 'No owner' when the agent has no owner, and no owner picker", async () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No owner');
    });
    expect(container.querySelector('a[href^="/users/"]')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
  });

  it('shows the team as unavailable and hides the projects editor when the lookup fails', async () => {
    mockGetAgentTeam.mockRejectedValueOnce(new Error('boom'));
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Unavailable');
    });
    expect(container.textContent).not.toContain('No owner');
    expect(container.querySelector('[data-testid="agent-projects-editor"]')).toBeNull();
  });

  it('ignores a project save that resolves for another agent', async () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="agent-projects-editor-stale"]')).not.toBeNull();
    });
    (
      container.querySelector('[data-testid="agent-projects-editor-stale"]') as HTMLButtonElement
    ).click();
    await Promise.resolve();
    expect(container.querySelector('a[href="/projects/p-stale"]')).toBeNull();
  });

  it('updates the project tags when the editor reports a change', async () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="agent-projects-editor"]')).not.toBeNull();
    });
    (container.querySelector('[data-testid="agent-projects-editor"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(container.querySelector('a[href="/projects/p-new"]')?.textContent).toBe('New');
    });
  });

  it('renders an H1 with the agent name', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('h1')?.textContent?.trim()).toBe('my-agent');
  });

  it('renders a tablist with exactly 5 tabs', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    const tabs = tablist!.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(5);
  });

  it('renders tabs labeled Overview, Routing, Providers, Limits, Settings in order', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    const labels = Array.from(tabs).map((t) => t.textContent);
    expect(labels).toEqual(['Overview', 'Routing', 'Providers and models', 'Limits', 'Settings']);
  });

  it('Overview tab links to the agent root path', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[0].getAttribute('href')).toBe('/agents/my-agent');
  });

  it('Routing tab links to /agents/:name/routing', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[1].getAttribute('href')).toBe('/agents/my-agent/routing');
  });

  it('Providers tab links to /agents/:name/providers', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[2].getAttribute('href')).toBe('/agents/my-agent/providers');
  });

  it('Limits tab links to /agents/:name/guardrails', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[3].getAttribute('href')).toBe('/agents/my-agent/guardrails');
  });

  it('Settings tab links to /agents/:name/settings', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[4].getAttribute('href')).toBe('/agents/my-agent/settings');
  });

  it('marks Overview tab active when pathname is the agent root', () => {
    mockPathname = '/agents/my-agent';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(tabs[2].getAttribute('aria-selected')).toBe('false');
    expect(tabs[3].getAttribute('aria-selected')).toBe('false');
    expect(tabs[4].getAttribute('aria-selected')).toBe('false');
  });

  it('marks Overview tab active when pathname is /overview', () => {
    mockPathname = '/agents/my-agent/overview';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('marks Routing tab active when pathname is /routing', () => {
    mockPathname = '/agents/my-agent/routing';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('marks Limits tab active when pathname is /guardrails', () => {
    mockPathname = '/agents/my-agent/guardrails';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[3].getAttribute('aria-selected')).toBe('true');
  });

  it('marks Providers tab active when pathname is /providers', () => {
    mockPathname = '/agents/my-agent/providers';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
  });

  it('marks Settings tab active when pathname starts with /settings', () => {
    mockPathname = '/agents/my-agent/settings/advanced';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[4].getAttribute('aria-selected')).toBe('true');
  });

  it('renders children inside the shell', () => {
    const { container } = render(() => (
      <AgentDetail>
        <div data-testid="child-content">Tab content</div>
      </AgentDetail>
    ));
    expect(container.querySelector('[data-testid="child-content"]')).not.toBeNull();
  });

  it('decodes URL-encoded agent names in title', () => {
    mockParams.agentName = 'my%20agent';
    mockPathname = '/agents/my%20agent';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('title')?.textContent).toBe('my agent | Manifest');
    expect(container.querySelector('h1')?.textContent?.trim()).toBe('my agent');
  });

  it('does not show platform icon when agentPlatformIcon returns undefined', () => {
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('img')).toBeNull();
  });

  it('applies panel__tab--active class to the active tab', () => {
    mockPathname = '/agents/my-agent/routing';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[1].className).toContain('panel__tab--active');
    expect(tabs[0].className).not.toContain('panel__tab--active');
  });

  it('uses resolved display name in title when agentDisplayName is set', () => {
    mockAgentDisplayName = 'My Cool Agent';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('title')?.textContent).toBe('My Cool Agent | Manifest');
  });

  it('renders the H1 with the display name when agentDisplayName is set', () => {
    mockAgentDisplayName = 'My Cool Agent';
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('h1')?.textContent?.trim()).toBe('My Cool Agent');
  });

  it('falls back to decoded slug in title when agentDisplayName is null', () => {
    mockAgentDisplayName = null;
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('title')?.textContent).toBe('my-agent | Manifest');
  });

  it('renders the H1 with the decoded slug when agentDisplayName is null', () => {
    mockAgentDisplayName = null;
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('h1')?.textContent?.trim()).toBe('my-agent');
  });
});

describe('AgentDetail with platform icon', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders the platform icon and H1 when agentPlatformIcon is set', async () => {
    vi.doMock('../../src/services/agent-platform-store.js', () => ({
      agentPlatformIcon: () => '/icons/robot.svg',
    }));
    vi.doMock('../../src/services/agent-display-name.js', () => ({
      agentDisplayName: () => null,
    }));
    vi.doMock('@solidjs/router', () => ({
      useParams: () => ({ agentName: 'my-agent' }),
      useLocation: () => ({ pathname: '/agents/my-agent' }),
      A: (props: any) => (
        <a href={props.href} role={props.role}>
          {props.children}
        </a>
      ),
    }));
    vi.doMock('@solidjs/meta', () => ({
      Title: (props: any) => <title>{props.children}</title>,
    }));

    const { default: AgentDetailWithIcon } = await import('../../src/pages/AgentDetail');
    const { container } = render(() => <AgentDetailWithIcon>{null}</AgentDetailWithIcon>);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/icons/robot.svg');
    expect(container.querySelector('h1')?.textContent?.trim()).toBe('my-agent');
  });
});

describe('AgentDetail team lookup states', () => {
  it('shows a pending marker while the team loads, then the owner state', async () => {
    let resolveTeam!: (team: Team) => void;
    mockGetAgentTeam.mockReturnValueOnce(new Promise<Team>((res) => (resolveTeam = res)));
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.textContent).not.toContain('No owner');
    resolveTeam({ owner: null, projects: [], archived_at: null });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No owner');
    });
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('offers a retry after a failed lookup and recovers', async () => {
    mockGetAgentTeam.mockRejectedValueOnce(new Error('boom'));
    const { container } = render(() => <AgentDetail>{null}</AgentDetail>);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Unavailable');
    });
    const retry = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Retry',
    ) as HTMLButtonElement;
    retry.click();
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No owner');
    });
    expect(mockGetAgentTeam.mock.calls.length).toBeGreaterThan(1);
  });
});
