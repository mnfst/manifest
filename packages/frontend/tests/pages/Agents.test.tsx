import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

// Reactive search params: the page derives every filter from the URL, so the
// mock must notify Solid when `setSearchParams` writes.
const paramsBox = vi.hoisted(() => ({
  read: (): Record<string, string | undefined> => ({}),
  write: (_patch: Record<string, string | undefined>) => {},
}));
const mockSetSearchParams = vi.fn((patch: Record<string, string | undefined>) =>
  paramsBox.write(patch),
);
vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [
    new Proxy({}, { get: (_t, key) => paramsBox.read()[key as string] }),
    mockSetSearchParams,
  ],
  A: (props: any) => (
    <a href={props.href} class={props.class} style={props.style}>
      {props.children}
    </a>
  ),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ''} content={props.content ?? ''} />,
}));

const mockDeleteAgent = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  deleteAgent: (...args: unknown[]) => mockDeleteAgent(...args),
}));

const mockListAgents = vi.fn();
const mockArchiveAgent = vi.fn();
const mockUnarchiveAgent = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  listAgents: (...args: unknown[]) => mockListAgents(...args),
  archiveAgent: (...args: unknown[]) => mockArchiveAgent(...args),
  unarchiveAgent: (...args: unknown[]) => mockUnarchiveAgent(...args),
}));

vi.mock('../../src/services/sse.js', () => ({
  agentPing: () => 0,
  analyticsPing: () => 0,
}));

const mockToast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

vi.mock('manifest-shared', () => ({
  AGENT_PLATFORMS: ['openclaw', 'claude-code', 'openai-sdk', 'other'],
  PLATFORM_LABELS: {
    openclaw: 'OpenClaw',
    'claude-code': 'Claude Code',
    'openai-sdk': 'OpenAI SDK',
    other: 'Other',
  },
  platformIcon: (platform: string | null) => (platform ? `/icons/${platform}.svg` : undefined),
}));

vi.mock('../../src/components/AddAgentModal.jsx', () => ({
  default: (props: any) => (
    <div data-testid="add-agent-modal" data-open={String(props.open)}>
      <button data-testid="add-close" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/DuplicateAgentModal.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="duplicate-modal"
      data-open={String(props.open)}
      data-source={props.sourceName}
    >
      <button data-testid="duplicate-done" onClick={() => props.onDuplicated?.()}>
        done
      </button>
      <button data-testid="duplicate-close" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/OwnerProjectFilters.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="owner-project-filters"
      data-owners={props.owners.join(',')}
      data-projects={props.projects.join(',')}
    >
      <button data-testid="pick-owner" onClick={() => props.onOwnersChange(['u-maya', 'none'])}>
        owner
      </button>
      <button data-testid="clear-owner" onClick={() => props.onOwnersChange([])}>
        clear owner
      </button>
      <button data-testid="pick-project" onClick={() => props.onProjectsChange(['p-atlas'])}>
        project
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/BulkProjectsEditor.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="bulk-projects"
      data-open={String(props.open)}
      data-count={props.selectedCount}
      data-selection={JSON.stringify(props.selection)}
    >
      <button
        data-testid="bulk-projects-apply"
        onClick={() =>
          props.onApplied({
            applied: ['a'],
            failed: [{ agent_name: 'b', reason: 'Agent is archived' }],
          })
        }
      >
        apply
      </button>
      <button data-testid="bulk-projects-close" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/CopySettingsModal.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="copy-settings"
      data-open={String(props.open)}
      data-count={props.selectedCount}
      data-selection={JSON.stringify(props.selection)}
    >
      <button
        data-testid="copy-apply"
        onClick={() => props.onApplied({ applied: ['a', 'b'], failed: [] })}
      >
        apply
      </button>
      <button data-testid="copy-close" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}));

import Agents from '../../src/pages/Agents';

const row = (overrides: Record<string, unknown> = {}) => ({
  agent_name: 'claude-code',
  display_name: 'claude-code',
  agent_platform: 'claude-code',
  agent_category: 'coding',
  owner: { id: 'u-maya', name: 'Maya Okonkwo' },
  projects: [{ id: 'p-atlas', name: 'Atlas' }],
  models_enabled: 12,
  models_total: 40,
  spend_30d_usd: 121.3,
  request_count: 12880,
  last_used_at: new Date(Date.now() - 120_000).toISOString(),
  archived_at: null,
  ...overrides,
});

const rows = [
  row(),
  row({
    agent_name: 'daily-report',
    display_name: 'daily-report',
    agent_platform: 'openai-sdk',
    agent_category: 'app',
    owner: null,
    projects: [
      { id: 'p-hsbc', name: 'HSBC' },
      { id: 'p-atlas', name: 'Atlas' },
      { id: 'p-north', name: 'Northwind' },
    ],
    models_enabled: 40,
    models_total: 40,
    spend_30d_usd: 88.1,
    last_used_at: null,
  }),
  row({
    agent_name: 'old-bot',
    display_name: 'old-bot',
    agent_platform: null,
    agent_category: null,
    projects: [],
    archived_at: '2026-08-01T00:00:00.000Z',
  }),
];

const response = (overrides: Record<string, unknown> = {}) => ({
  agents: rows,
  total: rows.length,
  unowned_total: 1,
  page: 1,
  page_size: 50,
  ...overrides,
});

let setParams: (next: Record<string, string | undefined>) => void;

const renderPage = () => render(() => <Agents />);
const waitForRows = async () => {
  await vi.waitFor(() => expect(screen.queryByText('daily-report')).not.toBeNull());
};

describe('Agents page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const [params, set] = createSignal<Record<string, string | undefined>>({});
    paramsBox.read = params;
    paramsBox.write = (patch) => set({ ...params(), ...patch });
    setParams = (next) => set(next);
    mockListAgents.mockResolvedValue(response());
    mockArchiveAgent.mockResolvedValue(undefined);
    mockUnarchiveAgent.mockResolvedValue(undefined);
    mockDeleteAgent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a skeleton while loading', () => {
    mockListAgents.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Every agent that routes through Manifest');
  });

  it('shows an error state with retry', async () => {
    mockListAgents.mockRejectedValueOnce(new Error('boom'));
    const { container } = renderPage();
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    mockListAgents.mockResolvedValue(response());
    fireEvent.click(screen.getByText('Try again'));
    await waitForRows();
  });

  it('shows the empty state and opens the New agent modal from it', async () => {
    mockListAgents.mockResolvedValue(response({ agents: [], total: 0, unowned_total: 0 }));
    const { container } = renderPage();
    await vi.waitFor(() => expect(container.textContent).toContain('No agents yet'));
    fireEvent.click(screen.getAllByText('New agent').at(-1)!);
    expect(screen.getByTestId('add-agent-modal').getAttribute('data-open')).toBe('true');
    fireEvent.click(screen.getByTestId('add-close'));
    expect(screen.getByTestId('add-agent-modal').getAttribute('data-open')).toBe('false');
  });

  it('shows the filtered-empty state and clears filters', async () => {
    setParams({ q: 'zzz', owners: 'u-maya', archived: '1' });
    mockListAgents.mockResolvedValue(response({ agents: [], total: 0 }));
    const { container } = renderPage();
    await vi.waitFor(() =>
      expect(container.textContent).toContain('No agents match these filters'),
    );
    expect(mockListAgents).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'zzz', owners: ['u-maya'], include_archived: true }),
    );
    fireEvent.click(screen.getByText('Clear filters'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      {
        q: undefined,
        owners: undefined,
        projects: undefined,
        types: undefined,
        archived: undefined,
        page: undefined,
      },
      { replace: true },
    );
    expect((screen.getByLabelText('Search agents') as HTMLInputElement).value).toBe('');
  });

  it('renders the rows, counts, owners, projects, models and last-used values', async () => {
    const { container } = renderPage();
    await waitForRows();
    expect(container.textContent).toContain('3 agents · 1 without an owner');
    expect(container.textContent).toContain('Maya Okonkwo');
    expect(container.textContent).toContain('No owner');
    expect(container.textContent).toContain('12 of 40');
    expect(container.textContent).toContain('All 40');
    expect(container.textContent).toContain('$121.30');
    expect(container.textContent).toContain('2m ago');
    expect(container.textContent).toContain('Never');
    expect(container.textContent).toContain('Claude Code');
    expect(container.textContent).toContain('OpenAI SDK');
    expect(container.textContent).toContain('Archived');
    expect(container.querySelector('a[href="/agents/claude-code"]')).not.toBeNull();
    const plus = container.querySelector('.project-tag--muted[title]');
    expect(plus?.textContent).toBe('+1');
    expect(plus?.getAttribute('title')).toBe('Northwind');
    expect(screen.getByText('None')).toBeTruthy();
    expect(container.querySelectorAll('img.who__icon').length).toBe(2);
  });

  it('debounces the search into the URL and resets the page', async () => {
    vi.useFakeTimers();
    renderPage();
    const input = screen.getByLabelText('Search agents') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'cla' } });
    fireEvent.input(input, { target: { value: 'claude' } });
    expect(mockSetSearchParams).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      { q: 'claude', page: undefined },
      { replace: true },
    );
    await vi.waitFor(() =>
      expect(mockListAgents).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'claude' }),
      ),
    );
  });

  it('writes owner, project, type and archived filters to the URL', async () => {
    const { container } = renderPage();
    await waitForRows();
    fireEvent.click(screen.getByTestId('pick-owner'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { owners: 'u-maya,none', page: undefined },
      { replace: true },
    );
    fireEvent.click(screen.getByTestId('clear-owner'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { owners: undefined, page: undefined },
      { replace: true },
    );
    fireEvent.click(screen.getByTestId('pick-project'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { projects: 'p-atlas', page: undefined },
      { replace: true },
    );
    fireEvent.click(screen.getByLabelText('Type filter'));
    fireEvent.click(screen.getByText('OpenClaw'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { types: 'openclaw', page: undefined },
      { replace: true },
    );
    fireEvent.click(screen.getByLabelText('Include archived'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { archived: '1', page: undefined },
      { replace: true },
    );
    await vi.waitFor(() =>
      expect(mockListAgents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          projects: ['p-atlas'],
          types: ['openclaw'],
          include_archived: true,
        }),
      ),
    );
    expect((container.querySelector('.filter-checkbox input') as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByLabelText('Include archived'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { archived: undefined, page: undefined },
      { replace: true },
    );
  });

  it('sorts by a column, flips direction on a second click, and defaults spend to descending', async () => {
    renderPage();
    await waitForRows();
    fireEvent.click(screen.getByText('Owner'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { sort: 'owner', dir: 'asc', page: undefined },
      { replace: true },
    );
    fireEvent.click(screen.getByText('Owner'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { sort: 'owner', dir: 'desc', page: undefined },
      { replace: true },
    );
    fireEvent.click(screen.getByText('Spend 30d'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { sort: 'spend_30d', dir: 'desc', page: undefined },
      { replace: true },
    );
    await vi.waitFor(() =>
      expect(mockListAgents).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'spend_30d', dir: 'desc' }),
      ),
    );
    fireEvent.click(screen.getByText('Last used'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { sort: 'last_used', dir: 'desc', page: undefined },
      { replace: true },
    );
    await vi.waitFor(() =>
      expect(screen.getByText('Last used').closest('th')?.getAttribute('aria-sort')).toBe(
        'descending',
      ),
    );
    const header = (label: string) =>
      screen.getAllByText(label).find((el) => el.closest('th')) as HTMLElement;
    fireEvent.click(header('Projects'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { sort: 'projects', dir: 'asc', page: undefined },
      { replace: true },
    );
    await vi.waitFor(() =>
      expect(header('Projects').closest('th')?.getAttribute('aria-sort')).toBe('ascending'),
    );
    fireEvent.click(header('Models'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith(
      { sort: 'models', dir: 'asc', page: undefined },
      { replace: true },
    );
    await vi.waitFor(() =>
      expect(header('Models').closest('th')?.getAttribute('aria-sort')).toBe('ascending'),
    );
    setParams({ sort: 'bogus', dir: 'up', page: 'nope' });
    await vi.waitFor(() =>
      expect(mockListAgents).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'agent', dir: 'asc', page: 1 }),
      ),
    );
  });

  it('opens the New agent modal from ?add=true and clears the param', async () => {
    setParams({ add: 'true' });
    renderPage();
    await vi.waitFor(() =>
      expect(screen.getByTestId('add-agent-modal').getAttribute('data-open')).toBe('true'),
    );
    expect(mockSetSearchParams).toHaveBeenCalledWith({ add: undefined }, { replace: true });
  });

  it('selects rows, the whole page, and distinguishes select-all-matching', async () => {
    mockListAgents.mockResolvedValue(response({ total: 1148 }));
    const { container } = renderPage();
    await waitForRows();
    expect(container.querySelector('.bulk-bar')).toBeNull();
    fireEvent.click(screen.getByLabelText('Select claude-code'));
    expect(container.querySelector('.bulk-bar__count')?.textContent).toBe('1 selected');
    const header = screen.getByLabelText('Select all on this page') as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    expect(screen.queryByText(/Select all 1,148 agents/)).toBeNull();
    fireEvent.click(header);
    expect(container.querySelector('.bulk-bar__count')?.textContent).toBe('3 selected');
    expect(header.checked).toBe(true);
    fireEvent.click(screen.getByTestId('bulk-projects-close'));
    fireEvent.click(screen.getByText('Projects', { selector: 'button.btn' }));
    expect(screen.getByTestId('bulk-projects').getAttribute('data-count')).toBe('3');
    expect(JSON.parse(screen.getByTestId('bulk-projects').getAttribute('data-selection')!)).toEqual(
      {
        kind: 'names',
        agent_names: ['claude-code', 'daily-report', 'old-bot'],
      },
    );
    fireEvent.click(screen.getByText('Select all 1,148 agents'));
    expect(container.querySelector('.bulk-bar__count')?.textContent).toBe(
      'All 1,148 agents selected',
    );
    expect(screen.queryByText('Select all 1,148 agents')).toBeNull();
    expect(JSON.parse(screen.getByTestId('bulk-projects').getAttribute('data-selection')!)).toEqual(
      {
        kind: 'query',
        query: {
          include_archived: false,
          sort: 'agent',
          dir: 'asc',
          owners: [],
          projects: [],
          types: [],
        },
        expected_total: 1148,
      },
    );
    expect((screen.getByLabelText('Select old-bot') as HTMLInputElement).checked).toBe(true);
    // Touching a single row narrows back to an explicit selection.
    fireEvent.click(screen.getByLabelText('Select old-bot'));
    expect(container.querySelector('.bulk-bar__count')?.textContent).toBe('2 selected');
    fireEvent.click(header);
    expect(container.querySelector('.bulk-bar__count')?.textContent).toBe('3 selected');
    fireEvent.click(header);
    expect(container.querySelector('.bulk-bar')).toBeNull();
    fireEvent.click(header);
    fireEvent.click(screen.getByText('Clear selection'));
    expect(container.querySelector('.bulk-bar')).toBeNull();
  });

  it('clears the selection when the query changes', async () => {
    renderPage();
    await waitForRows();
    fireEvent.click(screen.getByLabelText('Select claude-code'));
    expect(screen.getByText('1 selected')).toBeTruthy();
    fireEvent.click(screen.getByText('Owner'));
    await vi.waitFor(() => expect(screen.queryByText('1 selected')).toBeNull());
  });

  it('runs the Projects bulk action and reports partial failure', async () => {
    const { container } = renderPage();
    await waitForRows();
    fireEvent.click(screen.getByLabelText('Select claude-code'));
    fireEvent.click(screen.getByText('Projects', { selector: 'button.btn' }));
    expect(screen.getByTestId('bulk-projects').getAttribute('data-open')).toBe('true');
    fireEvent.click(screen.getByTestId('bulk-projects-apply'));
    await vi.waitFor(() => expect(container.querySelector('.bulk-result')).not.toBeNull());
    expect(container.textContent).toContain('Project changes: applied to 1 agent, 1 did not apply');
    expect(container.textContent).toContain('Agent is archived');
    expect(screen.getByTestId('bulk-projects').getAttribute('data-open')).toBe('false');
    expect(container.querySelector('.bulk-bar')).toBeNull();
    expect(mockListAgents.mock.calls.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(container.querySelector('.bulk-result')).toBeNull();
  });

  it('runs the Copy settings bulk action', async () => {
    const { container } = renderPage();
    await waitForRows();
    fireEvent.click(screen.getByLabelText('Select claude-code'));
    fireEvent.click(screen.getByText('Copy settings from…'));
    expect(screen.getByTestId('copy-settings').getAttribute('data-open')).toBe('true');
    expect(screen.getByTestId('copy-settings').getAttribute('data-count')).toBe('1');
    fireEvent.click(screen.getByTestId('copy-close'));
    expect(screen.getByTestId('copy-settings').getAttribute('data-open')).toBe('false');
    fireEvent.click(screen.getByText('Copy settings from…'));
    fireEvent.click(screen.getByTestId('copy-apply'));
    await vi.waitFor(() =>
      expect(container.textContent).toContain('Copied settings: applied to 2 agents'),
    );
    expect(container.querySelector('.bulk-result--failed')).toBeNull();
  });

  it('duplicates, archives and unarchives from the row menu', async () => {
    renderPage();
    await waitForRows();
    fireEvent.click(screen.getByLabelText('Actions for claude-code'));
    fireEvent.click(screen.getByText('Duplicate'));
    expect(screen.getByTestId('duplicate-modal').getAttribute('data-open')).toBe('true');
    expect(screen.getByTestId('duplicate-modal').getAttribute('data-source')).toBe('claude-code');
    fireEvent.click(screen.getByTestId('duplicate-done'));
    fireEvent.click(screen.getByTestId('duplicate-close'));
    expect(screen.getByTestId('duplicate-modal').getAttribute('data-open')).toBe('false');

    fireEvent.click(screen.getByLabelText('Actions for claude-code'));
    fireEvent.click(screen.getByText('Archive'));
    await vi.waitFor(() => expect(mockArchiveAgent).toHaveBeenCalledWith('claude-code'));
    expect(mockToast.success).toHaveBeenCalledWith('Agent "claude-code" archived');

    fireEvent.click(screen.getByLabelText('Actions for old-bot'));
    fireEvent.click(screen.getByText('Unarchive'));
    await vi.waitFor(() => expect(mockUnarchiveAgent).toHaveBeenCalledWith('old-bot'));
    expect(mockToast.success).toHaveBeenCalledWith('Agent "old-bot" restored');
  });

  it('toasts when archiving fails', async () => {
    mockArchiveAgent.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitForRows();
    fireEvent.click(screen.getByLabelText('Actions for claude-code'));
    fireEvent.click(screen.getByText('Archive'));
    await vi.waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith('Couldn\'t archive "claude-code".'),
    );
  });

  it('deletes an agent after the name is typed to confirm', async () => {
    const { container } = renderPage();
    await waitForRows();
    fireEvent.click(screen.getByLabelText('Actions for daily-report'));
    fireEvent.click(screen.getByText('Delete'));
    expect(container.textContent).toContain('Delete daily-report');
    const confirm = screen.getByText('Delete agent') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(mockDeleteAgent).not.toHaveBeenCalled();
    const input = container.querySelector('#agents-delete-confirm') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'daily-report' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(mockDeleteAgent).toHaveBeenCalledWith('daily-report'));
    expect(mockToast.success).toHaveBeenCalledWith('Agent "daily-report" deleted');
    await vi.waitFor(() => expect(container.querySelector('#agents-delete-confirm')).toBeNull());
  });

  it('keeps the delete modal open when the delete fails, and closes it on Cancel, overlay and Escape', async () => {
    mockDeleteAgent.mockRejectedValue(new Error('boom'));
    const { container } = renderPage();
    await waitForRows();
    const openDelete = () => {
      fireEvent.click(screen.getByLabelText('Actions for claude-code'));
      fireEvent.click(screen.getByText('Delete'));
    };
    openDelete();
    fireEvent.input(container.querySelector('#agents-delete-confirm')!, {
      target: { value: 'claude-code' },
    });
    fireEvent.click(screen.getByText('Delete agent'));
    await vi.waitFor(() => expect(mockDeleteAgent).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect((screen.getByText('Delete agent') as HTMLButtonElement).disabled).toBe(false),
    );
    expect(container.querySelector('#agents-delete-confirm')).not.toBeNull();
    fireEvent.click(screen.getByText('Cancel'));
    expect(container.querySelector('#agents-delete-confirm')).toBeNull();
    openDelete();
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(container.querySelector('#agents-delete-confirm')).not.toBeNull();
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(container.querySelector('#agents-delete-confirm')).toBeNull();
    openDelete();
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(container.querySelector('#agents-delete-confirm')).toBeNull();
  });

  it('pages through results', async () => {
    mockListAgents.mockResolvedValue(response({ total: 120 }));
    renderPage();
    await waitForRows();
    expect(screen.getByText(/Showing 1–50 of 120/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith({ page: '2' }, { replace: true });
    await vi.waitFor(() =>
      expect(mockListAgents).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );
    fireEvent.click(screen.getByLabelText('Go to previous page'));
    expect(mockSetSearchParams).toHaveBeenLastCalledWith({ page: '1' }, { replace: true });
    setParams({ page: '3' });
    await vi.waitFor(() =>
      expect(mockListAgents).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })),
    );
    expect((screen.getByLabelText('Go to next page') as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses the singular for one agent', async () => {
    mockListAgents.mockResolvedValue(response({ agents: [rows[0]], total: 1, unowned_total: 0 }));
    const { container } = renderPage();
    await vi.waitFor(() => expect(container.textContent).toContain('1 agent · 0 without an owner'));
  });
});
