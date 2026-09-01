import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

let mockPathname = '/projects/p-1';
const mockParams = { projectId: 'p-1' };
vi.mock('@solidjs/router', () => ({
  useParams: () => mockParams,
  useLocation: () => ({ pathname: mockPathname }),
  A: (props: any) => (
    <a
      href={props.href}
      class={[props.class, props.classList?.['panel__tab--active'] ? 'panel__tab--active' : '']
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

const mockGetProject = vi.fn();
const mockGetProjectOverview = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
  getProjectOverview: (...args: unknown[]) => mockGetProjectOverview(...args),
}));

const mockSetBreadcrumb = vi.fn();
const mockClearBreadcrumb = vi.fn();
vi.mock('../../src/services/breadcrumb-store.js', () => ({
  setBreadcrumb: (...args: unknown[]) => mockSetBreadcrumb(...args),
  clearBreadcrumb: (...args: unknown[]) => mockClearBreadcrumb(...args),
}));

vi.mock('../../src/services/sse.js', () => ({ analyticsPing: () => 0 }));

const mockDownload = vi.fn();
vi.mock('../../src/services/teams-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/teams-utils.js')>()),
  downloadTextFile: (...args: unknown[]) => mockDownload(...args),
}));

import ProjectDetail, { lastUsedLabel, useProjectDetail } from '../../src/pages/ProjectDetail';

const project = {
  id: 'p-1',
  name: 'HSBC',
  description: 'Client engagement',
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
};

const overview = {
  cost_month_usd: 100,
  cost_trend_pct: 5,
  cost_last_month_usd: 90,
  requests: 10,
  tokens: 100,
  cost_series: [],
  tokens_series: [],
  cost_by_owner: [],
  agents: [
    {
      agent_name: 'daily-report',
      display_name: 'Daily report',
      agent_platform: 'openai-sdk',
      agent_category: 'app',
      owner: null,
      projects: [{ id: 'p-1', name: 'HSBC' }],
      models_enabled: 2,
      models_total: 40,
      spend_30d_usd: 88.1,
      request_count: 120,
      last_used_at: '2026-08-27T10:00:00Z',
      archived_at: null,
    },
    {
      agent_name: 'claude-code',
      display_name: 'Claude Code',
      agent_platform: 'claude-code',
      agent_category: 'coding',
      owner: { id: 'u1', name: 'Maya Okonkwo' },
      projects: [{ id: 'p-1', name: 'HSBC' }],
      models_enabled: 12,
      models_total: 40,
      spend_30d_usd: 121.3,
      request_count: 500,
      last_used_at: null,
      archived_at: null,
    },
  ],
  users: [
    {
      id: 'u1',
      name: 'Maya Okonkwo',
      email: null,
      role: 'Engineering',
      archived_at: null,
      created_at: '2026-08-01T00:00:00Z',
      agent_count: 1,
      spend_30d_usd: 121.3,
      spend_365d_usd: 121.3,
      last_active_at: null,
    },
  ],
  spend_shared: false,
};

const Probe = () => {
  const ctx = useProjectDetail();
  return (
    <div data-testid="probe">
      {ctx.projectId()}:{ctx.project()?.name}:{String(ctx.overview()?.requests)}
      <button onClick={() => ctx.refetchProject()}>refetch-project</button>
      <button onClick={() => ctx.refetchOverview()}>refetch-overview</button>
    </div>
  );
};

describe('ProjectDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/projects/p-1';
    mockParams.projectId = 'p-1';
    mockGetProject.mockResolvedValue(project);
    mockGetProjectOverview.mockResolvedValue(overview);
  });

  it('renders header, chips, tabs and children with context', async () => {
    const { container, getByTestId, getByText } = render(() => (
      <ProjectDetail>
        <Probe />
      </ProjectDetail>
    ));
    await vi.waitFor(() => expect(container.querySelector('h1')?.textContent).toBe('HSBC'));
    expect(container.querySelector('title')?.textContent).toBe('HSBC | Manifest');
    await vi.waitFor(() => expect(container.textContent).toContain('2 agents · 1 user'));
    expect(container.textContent).toContain('Client engagement');
    expect(getByTestId('probe').textContent).toContain('p-1:HSBC:10');
    expect(mockSetBreadcrumb).toHaveBeenCalledWith([{ label: 'Projects', href: '/projects' }], {
      label: 'HSBC',
    });
    const tabs = container.querySelectorAll('.panel__tab');
    expect(tabs.length).toBe(4);
    expect(tabs[0]!.classList.contains('panel__tab--active')).toBe(true);
    expect(tabs[1]!.getAttribute('href')).toBe('/projects/p-1/agents');
    fireEvent.click(getByText('refetch-project'));
    fireEvent.click(getByText('refetch-overview'));
    await vi.waitFor(() => expect(mockGetProject).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(mockGetProjectOverview).toHaveBeenCalledTimes(2));
  });

  it('marks the active tab from the pathname and singularizes counts', async () => {
    mockPathname = '/projects/p-1/users';
    mockGetProjectOverview.mockResolvedValue({ ...overview, agents: [overview.agents[0]] });
    const { container } = render(() => <ProjectDetail>{null}</ProjectDetail>);
    await vi.waitFor(() => expect(container.textContent).toContain('1 agent · 1 user'));
    const tabs = container.querySelectorAll('.panel__tab');
    expect(tabs[2]!.classList.contains('panel__tab--active')).toBe(true);
    expect(tabs[0]!.classList.contains('panel__tab--active')).toBe(false);
  });

  it('treats /overview as the overview tab and shows the Archived badge', async () => {
    mockPathname = '/projects/p-1/overview';
    mockGetProject.mockResolvedValue({
      ...project,
      description: null,
      archived_at: '2026-08-02T00:00:00Z',
    });
    const { container } = render(() => <ProjectDetail>{null}</ProjectDetail>);
    await vi.waitFor(() => expect(container.querySelector('h1')).not.toBeNull());
    expect(
      container.querySelectorAll('.panel__tab')[0]!.classList.contains('panel__tab--active'),
    ).toBe(true);
    expect(container.textContent).toContain('Archived');
    expect(container.textContent).not.toContain('Client engagement');
  });

  it('shows the not-found state and clears the breadcrumb on unmount', async () => {
    mockGetProject.mockResolvedValue(null);
    const { container, unmount } = render(() => <ProjectDetail>{null}</ProjectDetail>);
    await vi.waitFor(() => expect(container.textContent).toContain('Project not found'));
    expect(container.querySelector('a[href="/projects"]')).not.toBeNull();
    expect(container.querySelector('title')?.textContent).toBe('Project | Manifest');
    expect(mockSetBreadcrumb).not.toHaveBeenCalled();
    unmount();
    expect(mockClearBreadcrumb).toHaveBeenCalled();
  });

  it('survives an overview fetch failure', async () => {
    mockGetProjectOverview.mockRejectedValue(new Error('nope'));
    const { container, getByText } = render(() => <ProjectDetail>{null}</ProjectDetail>);
    await vi.waitFor(() => expect(container.querySelector('h1')?.textContent).toBe('HSBC'));
    await vi.waitFor(() =>
      expect((getByText('Export CSV') as HTMLButtonElement).disabled).toBe(true),
    );
    fireEvent.click(getByText('Export CSV'));
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('exports one CSV row per agent on the project', async () => {
    const { container, getByText } = render(() => <ProjectDetail>{null}</ProjectDetail>);
    await vi.waitFor(() =>
      expect((getByText('Export CSV') as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(getByText('Export CSV'));
    const [filename, csv] = mockDownload.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^project-HSBC-\d{4}-\d{2}\.csv$/);
    expect(csv.split('\n')).toEqual([
      'Agent,User,Requests,Spend (30d),Spend (365d),Last used',
      'Daily report,No user,120,88.10,,2026-08-27T10:00:00Z',
      'Claude Code,Maya Okonkwo,500,121.30,,',
    ]);
    expect(container.textContent).toContain('HSBC');
  });

  it('throws when the hook is used outside the shell', () => {
    expect(() => render(() => <Probe />)).toThrow(
      'useProjectDetail must be used inside ProjectDetail',
    );
  });

  it('labels a never-used agent', () => {
    expect(lastUsedLabel(null)).toBe('Never');
    expect(lastUsedLabel(new Date().toISOString())).toBe('Just now');
  });
});

describe('ProjectDetail — failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/projects/p-1';
    mockParams.projectId = 'p-1';
    mockGetProject.mockResolvedValue(project);
    mockGetProjectOverview.mockResolvedValue(overview);
  });

  it('shows an error state with retry when the project lookup fails', async () => {
    mockGetProject.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(project);
    const { container, getByText } = render(() => <ProjectDetail>{null}</ProjectDetail>);
    await vi.waitFor(() => expect(container.textContent).toContain("Couldn't load this project"));
    expect(container.textContent).toContain('boom');
    expect(container.textContent).not.toContain('Project not found');
    expect(container.querySelector('title')?.textContent).toBe('Project | Manifest');
    expect(mockSetBreadcrumb).not.toHaveBeenCalled();
    fireEvent.click(getByText('Try again'));
    await vi.waitFor(() => expect(container.querySelector('h1')?.textContent).toBe('HSBC'));
  });

  it('hands the overview error to the tabs instead of swallowing it', async () => {
    mockGetProjectOverview.mockRejectedValue(new Error('nope'));
    const ErrProbe = () => {
      const ctx = useProjectDetail();
      return (
        <span data-testid="err-probe">
          {String((ctx.overview.error as Error | undefined)?.message)}
        </span>
      );
    };
    const { getByTestId, container } = render(() => (
      <ProjectDetail>
        <ErrProbe />
      </ProjectDetail>
    ));
    await vi.waitFor(() => expect(getByTestId('err-probe').textContent).toBe('nope'));
    expect(container.textContent).not.toContain('agents ·');
  });
});
