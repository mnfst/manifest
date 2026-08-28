import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => (
    <a href={props.href} class={props.class} data-state={JSON.stringify(props.state ?? null)}>
      {props.children}
    </a>
  ),
}));

const mockSetAgentProjects = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  setAgentProjects: (...args: unknown[]) => mockSetAgentProjects(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

type Ctx = ReturnType<(typeof import('../../src/pages/ProjectDetail'))['useProjectDetail']>;
let mockCtx: Ctx;
vi.mock('../../src/pages/ProjectDetail.jsx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/pages/ProjectDetail.jsx')>()),
  useProjectDetail: () => mockCtx,
}));

import ProjectAgents from '../../src/pages/ProjectAgents';

const resource = <T,>(value: T, extra: { loading?: boolean; error?: unknown } = {}) =>
  Object.assign(() => value, { loading: false, error: undefined, state: 'ready', ...extra });

const agents = [
  {
    agent_name: 'claude-code',
    display_name: 'Claude Code',
    agent_platform: 'claude-code',
    agent_category: 'coding',
    owner: { id: 'u1', name: 'Maya Okonkwo' },
    projects: [
      { id: 'p-1', name: 'HSBC' },
      { id: 'p-2', name: 'Atlas' },
    ],
    models_enabled: 12,
    models_total: 40,
    spend_30d_usd: 121.3,
    request_count: 500,
    last_used_at: null,
    archived_at: null,
  },
  {
    agent_name: 'daily-report',
    display_name: 'Daily report',
    agent_platform: null,
    agent_category: null,
    owner: null,
    projects: [{ id: 'p-1', name: 'HSBC' }],
    models_enabled: 2,
    models_total: 40,
    spend_30d_usd: -1,
    request_count: 120,
    last_used_at: new Date().toISOString(),
    archived_at: null,
  },
];

const makeCtx = (
  list: unknown,
  project: unknown = { id: 'p-1', name: 'HSBC' },
  extra: { loading?: boolean; error?: unknown } = {},
): Ctx =>
  ({
    projectId: () => 'p-1',
    project: resource(project),
    overview: resource(list === undefined ? undefined : { agents: list }, extra),
    refetchProject: vi.fn(),
    refetchOverview: vi.fn(),
  }) as unknown as Ctx;

describe('ProjectAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = makeCtx(agents);
  });

  it('lists the agents with owner, models, spend and via-state links', () => {
    const { container } = render(() => <ProjectAgents />);
    const link = container.querySelector('a[href="/agents/claude-code"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('Claude Code');
    expect(JSON.parse(link.dataset.state!)).toEqual({
      via: [
        { label: 'Projects', href: '/projects' },
        { label: 'HSBC', href: '/projects/p-1' },
      ],
    });
    expect(link.querySelector('img.who__icon')).not.toBeNull();
    expect(container.querySelector('a[href="/agents/daily-report"] img')).toBeNull();
    expect(container.textContent).toContain('Maya Okonkwo');
    expect(container.querySelector('.pill-muted')?.textContent).toBe('No user');
    expect(container.textContent).toContain('12 of 40');
    expect(container.textContent).toContain('$121.30');
    expect(container.textContent).toContain('Never');
    expect(container.textContent).toContain('Just now');
    expect(container.textContent).toContain('-');
  });

  it('removes an agent from the project keeping its other projects', async () => {
    mockSetAgentProjects.mockResolvedValue(undefined);
    const { getAllByText } = render(() => <ProjectAgents />);
    fireEvent.click(getAllByText('Remove from project')[0]!);
    await vi.waitFor(() => expect(mockCtx.refetchOverview).toHaveBeenCalled());
    expect(mockSetAgentProjects).toHaveBeenCalledWith('claude-code', ['p-2']);
    expect(mockToast.success).toHaveBeenCalledWith('Removed Claude Code from HSBC');
  });

  it('falls back to "this project" in the toast and errors softly', async () => {
    mockCtx = makeCtx(agents, null);
    mockSetAgentProjects.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('x'));
    const { getAllByText } = render(() => <ProjectAgents />);
    fireEvent.click(getAllByText('Remove from project')[1]!);
    await vi.waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith('Removed Daily report from this project'),
    );
    expect(mockSetAgentProjects).toHaveBeenLastCalledWith('daily-report', []);
    fireEvent.click(getAllByText('Remove from project')[0]!);
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    const link = document.querySelector('a[href="/agents/claude-code"]') as HTMLAnchorElement;
    expect(JSON.parse(link.dataset.state!).via[1].label).toBe('p-1');
  });

  it('shows the empty state and the loading skeleton', () => {
    mockCtx = makeCtx([]);
    const empty = render(() => <ProjectAgents />);
    expect(empty.container.textContent).toContain('No agents on this project yet');
    empty.unmount();
    mockCtx = makeCtx(undefined, undefined, { loading: true });
    const { container } = render(() => <ProjectAgents />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
  });

  it('shows an unavailable state with retry once loading ends without data', () => {
    mockCtx = makeCtx(undefined);
    const { container, getByText } = render(() => <ProjectAgents />);
    expect(container.querySelector('.skeleton')).toBeNull();
    expect(container.textContent).toContain('Overview unavailable');
    fireEvent.click(getByText('Try again'));
    expect(mockCtx.refetchOverview).toHaveBeenCalled();
  });

  it('shows an error state with retry when the overview failed', () => {
    mockCtx = makeCtx(undefined, undefined, { error: new Error('boom') });
    const { container, getByText } = render(() => <ProjectAgents />);
    expect(container.textContent).toContain("Couldn't load this project's agents");
    expect(container.textContent).toContain('boom');
    fireEvent.click(getByText('Try again'));
    expect(mockCtx.refetchOverview).toHaveBeenCalled();
  });
});
