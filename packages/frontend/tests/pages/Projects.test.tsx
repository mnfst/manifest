import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

let mockSearchParams: Record<string, string | undefined> = {};
const mockSetSearchParams = vi.fn((next: Record<string, string | undefined>) => {
  mockSearchParams = { ...mockSearchParams, ...next };
});
vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [
    {
      get q() {
        return mockSearchParams.q;
      },
      get archived() {
        return mockSearchParams.archived;
      },
    },
    mockSetSearchParams,
  ],
  A: (props: any) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ''} content={props.content ?? ''} />,
}));

const mockGetProjects = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock('../../src/services/sse.js', () => ({ analyticsPing: () => 0 }));

const mockDownload = vi.fn();
vi.mock('../../src/services/teams-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/teams-utils.js')>()),
  downloadTextFile: (...args: unknown[]) => mockDownload(...args),
}));

vi.mock('../../src/components/ProjectModal.jsx', () => ({
  default: (props: any) => (
    <div data-testid="project-modal" data-open={String(props.open)}>
      <button onClick={() => props.onSaved({ id: 'p-x' })}>saved</button>
      <button onClick={() => props.onClose()}>close</button>
    </div>
  ),
}));

import Projects from '../../src/pages/Projects';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p-hsbc',
  name: 'HSBC',
  description: 'Client engagement',
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
  agent_count: 14,
  users: [
    { id: 'u1', name: 'Maya Okonkwo' },
    { id: 'u2', name: 'Tom Reyes' },
    { id: 'u3', name: 'Sara Lindqvist' },
    { id: 'u4', name: 'Deniz Kaya' },
  ],
  requests_7d: [18, 24, 21, 30, 27, 38, 44],
  requests_7d_total: 12400,
  spend_month_usd: 1204.8,
  spend_last_month_usd: 980.15,
  spend_shared: false,
  ...over,
});

describe('Projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
  });

  it('shows a skeleton while loading', () => {
    mockGetProjects.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <Projects />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(container.querySelector('title')?.textContent).toBe('Projects - Manifest');
  });

  it('renders rows with the description, users stack, daily bars and spend', async () => {
    mockGetProjects.mockResolvedValue({
      projects: [
        row(),
        row({
          id: 'p-atlas',
          name: 'Atlas',
          description: null,
          spend_shared: true,
          archived_at: '2026-08-02T00:00:00Z',
          users: [],
        }),
      ],
      total: 2,
    });
    const { container } = render(() => <Projects />);
    await vi.waitFor(() => expect(container.textContent).toContain('HSBC'));
    expect(container.textContent).toContain('2 projects ·');
    expect(container.querySelector('a[href="/projects/p-hsbc"]')?.textContent).toBe('HSBC');
    // The description sits in its own one-line column with the full text on hover.
    const description = container.querySelector('.cell-truncate')!;
    expect(description.textContent).toBe('Client engagement');
    expect(description.getAttribute('title')).toBe('Client engagement');
    expect(container.querySelectorAll('.cell-truncate').length).toBe(1);
    expect(container.querySelector('.who__sub')).toBeNull();
    expect(container.querySelector('.avatar-stack__more')?.textContent).toBe('+1');
    // Requests per day as bars, one per day, with the 7-day total beside them.
    expect(container.textContent).toContain('Requests (7d)');
    expect(container.querySelectorAll('.mini-bars').length).toBe(2);
    expect(container.querySelectorAll('.mini-bars rect').length).toBe(14);
    expect(container.querySelector('[title*="requests in the last 7 days"]')).not.toBeNull();
    expect(container.textContent).toContain('12.4k');
    expect(container.textContent).toContain('$1,204.80');
    expect(container.textContent).toContain('$980.15');
    // Shared cost is explained once, on the column header, not tagged per row.
    expect(container.querySelector('.project-tag--muted')).toBeNull();
    expect(container.textContent).not.toContain('counted in each project');
    expect(container.querySelector('.th-info')?.getAttribute('title')).toContain(
      'counted in full in each of them',
    );
    expect(container.textContent).toContain('Archived');
    expect(container.textContent).toContain('No users');
    expect(mockGetProjects).toHaveBeenCalledWith({ search: '', include_archived: false });
  });

  it('singularizes one project in the subtitle', async () => {
    mockGetProjects.mockResolvedValue({ projects: [row()], total: 1 });
    const { container } = render(() => <Projects />);
    await vi.waitFor(() => expect(container.textContent).toContain('1 project ·'));
  });

  it('renders the error state with retry', async () => {
    mockGetProjects
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ projects: [row()], total: 1 });
    const { container, getByText } = render(() => <Projects />);
    await vi.waitFor(() => expect(container.textContent).toContain('boom'));
    fireEvent.click(getByText('Try again'));
    await vi.waitFor(() => expect(container.textContent).toContain('HSBC'));
  });

  it('shows the empty state and opens the modal from it', async () => {
    mockGetProjects.mockResolvedValue({ projects: [], total: 0 });
    const { container, getAllByText, getByTestId, getByText } = render(() => <Projects />);
    await vi.waitFor(() => expect(container.textContent).toContain('No projects yet'));
    expect(getByTestId('project-modal').dataset.open).toBe('false');
    fireEvent.click(getAllByText('New project')[1]!);
    expect(getByTestId('project-modal').dataset.open).toBe('true');
    fireEvent.click(getByText('close'));
    expect(getByTestId('project-modal').dataset.open).toBe('false');
    expect((getByText('Export CSV') as HTMLButtonElement).disabled).toBe(true);
  });

  it('refetches after the modal saves', async () => {
    mockGetProjects.mockResolvedValue({ projects: [], total: 0 });
    const { container, getByText } = render(() => <Projects />);
    await vi.waitFor(() => expect(container.textContent).toContain('No projects yet'));
    fireEvent.click(getByText('saved'));
    await vi.waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(2));
  });

  it('shows the filtered-empty state and clears filters', async () => {
    mockSearchParams = { q: 'zzz', archived: 'true' };
    mockGetProjects.mockResolvedValue({ projects: [], total: 0 });
    const { container, getByText, getByLabelText } = render(() => <Projects />);
    await vi.waitFor(() =>
      expect(container.textContent).toContain('No projects match your filters'),
    );
    expect((getByLabelText('Search projects') as HTMLInputElement).value).toBe('zzz');
    expect(mockGetProjects).toHaveBeenCalledWith({ search: 'zzz', include_archived: true });
    fireEvent.click(getByText('Clear filters'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ q: undefined }, { replace: true });
    expect(mockSetSearchParams).toHaveBeenCalledWith({ archived: undefined }, { replace: true });
    await vi.waitFor(() =>
      expect(mockGetProjects).toHaveBeenCalledWith({ search: '', include_archived: false }),
    );
  });

  it('writes search and include-archived to the URL', async () => {
    mockGetProjects.mockResolvedValue({ projects: [row()], total: 1 });
    const { container, getByLabelText } = render(() => <Projects />);
    await vi.waitFor(() => expect(container.textContent).toContain('HSBC'));
    fireEvent.input(getByLabelText('Search projects'), { target: { value: 'hs' } });
    expect(mockSetSearchParams).toHaveBeenCalledWith({ q: 'hs' }, { replace: true });
    const checkbox = container.querySelector('.filter-checkbox input') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(mockSetSearchParams).toHaveBeenCalledWith({ archived: 'true' }, { replace: true });
    await vi.waitFor(() =>
      expect(mockGetProjects).toHaveBeenCalledWith({ search: 'hs', include_archived: true }),
    );
  });

  it('exports a CSV of the visible rows', async () => {
    mockGetProjects.mockResolvedValue({
      projects: [
        row(),
        row({ id: 'p2', name: 'Atlas, Inc', description: null, spend_shared: true }),
      ],
      total: 2,
    });
    const { container, getByText } = render(() => <Projects />);
    await vi.waitFor(() => expect(container.textContent).toContain('HSBC'));
    fireEvent.click(getByText('Export CSV'));
    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [filename, csv] = mockDownload.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^projects-\d{4}-\d{2}\.csv$/);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Project,Description,Agents,Users,Requests (7d),Spend this month,Last month,Agents shared with other projects',
    );
    expect(lines[1]).toBe('HSBC,Client engagement,14,4,12400,1204.80,980.15,no');
    expect(lines[2]).toBe('"Atlas, Inc",,14,4,12400,1204.80,980.15,yes');
  });
});
