import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
  type Component,
} from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { AGENT_PLATFORMS, PLATFORM_LABELS, platformIcon } from 'manifest-shared';
import ErrorState from '../components/ErrorState.jsx';
import ActionMenu from '../components/ActionMenu.jsx';
import AddAgentModal from '../components/AddAgentModal.jsx';
import DuplicateAgentModal from '../components/DuplicateAgentModal.jsx';
import Pagination from '../components/Pagination.jsx';
import MultiSelect from '../components/MultiSelect.jsx';
import FilterCheckbox from '../components/FilterCheckbox.jsx';
import OwnerProjectFilters from '../components/OwnerProjectFilters.jsx';
import SortableTh from '../components/SortableTh.jsx';
import TriStateCheckbox, { type TriState } from '../components/TriStateCheckbox.jsx';
import Avatar from '../components/Avatar.jsx';
import BulkResultNotice from '../components/BulkResultNotice.jsx';
import BulkProjectsEditor from '../components/BulkProjectsEditor.jsx';
import CopySettingsModal from '../components/CopySettingsModal.jsx';
import { deleteAgent } from '../services/api.js';
import {
  archiveAgent,
  listAgents,
  unarchiveAgent,
  type AgentListQuery,
  type AgentListResponse,
  type AgentRow,
  type AgentSortKey,
  type BulkResult,
  type BulkSelection,
} from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';
import { formatCost, formatTimeAgo } from '../services/formatters.js';
import { agentPath } from '../services/routing.js';
import { agentPing, analyticsPing } from '../services/sse.js';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 250;
const SORT_KEYS: AgentSortKey[] = [
  'agent',
  'owner',
  'projects',
  'models',
  'spend_30d',
  'last_used',
];

const splitList = (value: string | undefined): string[] =>
  typeof value === 'string' && value ? value.split(',').filter(Boolean) : [];
const joinList = (values: string[]): string | undefined =>
  values.length ? values.join(',') : undefined;

const DuplicateIcon: Component = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const ArchiveIcon: Component = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
);

const DeleteIcon: Component = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

/**
 * Agents. The page that replaces the sidebar list, built for a thousand rows:
 * server-side search, multi-select filters, sortable columns, paging, and
 * checkboxes for the two bulk actions (Projects, Copy settings from an agent).
 *
 * There is deliberately no "change owner" bulk action. Past activity has to
 * stay attributed to whoever owned the agent when it ran, so ownership is set
 * once at creation; to hand an agent over, archive it and create a fresh one
 * with "Copy settings from an agent".
 */
const Agents: Component = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    q?: string;
    owners?: string;
    projects?: string;
    types?: string;
    archived?: string;
    sort?: string;
    dir?: string;
    page?: string;
    add?: string;
  }>();

  // ── Filter state mirrored in the URL ──────────────────────────────
  const [searchInput, setSearchInput] = createSignal(
    typeof searchParams.q === 'string' ? searchParams.q : '',
  );
  const search = () => (typeof searchParams.q === 'string' ? searchParams.q : '');
  const owners = () => splitList(searchParams.owners);
  const projects = () => splitList(searchParams.projects);
  const types = () => splitList(searchParams.types);
  const includeArchived = () => searchParams.archived === '1';
  const sortKey = (): AgentSortKey =>
    SORT_KEYS.includes(searchParams.sort as AgentSortKey)
      ? (searchParams.sort as AgentSortKey)
      : 'agent';
  const sortDir = (): 'asc' | 'desc' => (searchParams.dir === 'desc' ? 'desc' : 'asc');
  const page = () => Math.max(1, Number(searchParams.page) || 1);

  const setFilter = (patch: Record<string, string | undefined>) =>
    setSearchParams({ ...patch, page: undefined }, { replace: true });

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const onSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setFilter({ q: value.trim() || undefined }), SEARCH_DEBOUNCE_MS);
  };
  onCleanup(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });

  const hasFilters = () =>
    search() !== '' ||
    owners().length > 0 ||
    projects().length > 0 ||
    types().length > 0 ||
    includeArchived();
  const clearFilters = () => {
    setSearchInput('');
    setFilter({
      q: undefined,
      owners: undefined,
      projects: undefined,
      types: undefined,
      archived: undefined,
    });
  };

  // Deep link: /agents?add=true opens the New agent modal (onboarding CTAs).
  const [modalOpen, setModalOpen] = createSignal(false);
  createEffect(() => {
    if (searchParams.add === 'true') {
      setModalOpen(true);
      setSearchParams({ add: undefined }, { replace: true });
    }
  });

  // ── Query ───────────────────────────────────────────────────────────
  const filterQuery = (): AgentListQuery => ({
    search: search() || undefined,
    owners: owners(),
    projects: projects(),
    types: types(),
    include_archived: includeArchived(),
    sort: sortKey(),
    dir: sortDir(),
  });
  const query = (): AgentListQuery => ({ ...filterQuery(), page: page(), page_size: PAGE_SIZE });

  const [data, { refetch }] = createResource(
    () => ({ query: query(), _a: agentPing(), _m: analyticsPing() }),
    (src) => listAgents(src.query) as Promise<AgentListResponse>,
  );
  // Reading an errored resource throws; every read goes through this guard so
  // the error state can render around the table.
  const loaded = (): AgentListResponse | undefined =>
    data.state === 'errored' ? undefined : data();
  const rows = () => loaded()?.agents ?? [];
  const total = () => loaded()?.total ?? 0;

  // ── Selection ──────────────────────────────────────────────────────
  // `selected` holds names on the current page; `selectAllMatching` widens
  // the selection to every agent the query matches, across all pages.
  const [selected, setSelected] = createSignal<Set<string>>(new Set<string>());
  const [selectAllMatching, setSelectAllMatching] = createSignal(false);
  const clearSelection = () => {
    setSelected(new Set<string>());
    setSelectAllMatching(false);
  };
  createEffect(on([query], () => clearSelection(), { defer: true }));

  const pageNames = () => rows().map((r) => r.agent_name);
  const pageSelectedCount = () => pageNames().filter((n) => selected().has(n)).length;
  const headerState = (): TriState =>
    pageNames().length > 0 && pageSelectedCount() === pageNames().length
      ? 'all'
      : pageSelectedCount() > 0
        ? 'some'
        : 'none';
  const toggleAllOnPage = () => {
    setSelectAllMatching(false);
    if (headerState() === 'all') setSelected(new Set<string>());
    else setSelected(new Set(pageNames()));
  };
  const toggleRow = (name: string) => {
    setSelectAllMatching(false);
    const next = new Set(selected());
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };
  const selectedCount = () => (selectAllMatching() ? total() : selected().size);
  const canSelectAllMatching = () =>
    !selectAllMatching() && headerState() === 'all' && total() > rows().length;
  const selection = (): BulkSelection =>
    selectAllMatching()
      ? { kind: 'query', query: filterQuery(), expected_total: total() }
      : { kind: 'names', agent_names: [...selected()] };

  // ── Bulk actions ────────────────────────────────────────────────────
  const [projectsEditorOpen, setProjectsEditorOpen] = createSignal(false);
  const [copyOpen, setCopyOpen] = createSignal(false);
  const [bulkResult, setBulkResult] = createSignal<{ action: string; result: BulkResult } | null>(
    null,
  );
  const onBulkApplied = (action: string) => (result: BulkResult) => {
    setProjectsEditorOpen(false);
    setCopyOpen(false);
    setBulkResult({ action, result });
    clearSelection();
    void refetch();
  };

  // ── Row actions ─────────────────────────────────────────────────────
  const [duplicateSource, setDuplicateSource] = createSignal<string | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = createSignal('');
  const [deleting, setDeleting] = createSignal(false);

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteConfirmName('');
  };

  const handleDelete = async () => {
    const target = deleteTarget();
    if (!target || deleteConfirmName() !== target) return;
    setDeleting(true);
    try {
      await deleteAgent(target);
      toast.success(`Agent "${target}" deleted`);
      closeDeleteModal();
      await refetch();
    } catch {
      // error toast handled by fetchMutate
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async (row: AgentRow) => {
    try {
      if (row.archived_at) {
        await unarchiveAgent(row.agent_name);
        toast.success(`Agent "${row.display_name}" restored`);
      } else {
        await archiveAgent(row.agent_name);
        toast.success(`Agent "${row.display_name}" archived`);
      }
      await refetch();
    } catch {
      toast.error(`Couldn't ${row.archived_at ? 'restore' : 'archive'} "${row.display_name}".`);
    }
  };

  const typeOptions = createMemo(() =>
    AGENT_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] })),
  );

  const modelsLabel = (row: AgentRow) =>
    row.models_total > 0 && row.models_enabled === row.models_total
      ? `All ${row.models_total}`
      : `${row.models_enabled} of ${row.models_total}`;

  const sortProps = {
    onSort: (key: string, dir: 'asc' | 'desc') => setFilter({ sort: key, dir }),
  };

  return (
    <div class="container--lg">
      <Title>Agents - Manifest</Title>
      <Meta
        name="description"
        content="View and manage all your agents. Monitor usage, requests, and costs."
      />
      <div class="page-header">
        <div>
          <h1>Agents</h1>
          <span class="breadcrumb">
            <Show when={loaded()} fallback="Every agent that routes through Manifest">
              {total().toLocaleString('en-US')} agent{total() === 1 ? '' : 's'} ·{' '}
              {(loaded()!.unowned_total ?? 0).toLocaleString('en-US')} without an owner
            </Show>
          </span>
        </div>
        <button class="btn btn--primary btn--sm" onClick={() => setModalOpen(true)}>
          New agent
        </button>
      </div>

      <div class="list-toolbar">
        <div class="list-search">
          <svg
            class="list-search__icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            class="list-search__input"
            type="search"
            placeholder="Search agents"
            aria-label="Search agents"
            value={searchInput()}
            onInput={(e) => onSearchInput(e.currentTarget.value)}
          />
        </div>
        <OwnerProjectFilters
          owners={owners()}
          projects={projects()}
          onOwnersChange={(values) => setFilter({ owners: joinList(values) })}
          onProjectsChange={(values) => setFilter({ projects: joinList(values) })}
        />
        <MultiSelect
          values={types()}
          onChange={(values) => setFilter({ types: joinList(values) })}
          options={typeOptions()}
          placeholder="All types"
          label="Type filter"
        />
        <FilterCheckbox
          label="Include archived"
          checked={includeArchived()}
          onChange={(on) => setFilter({ archived: on ? '1' : undefined })}
        />
      </div>

      <Show when={bulkResult()}>
        <BulkResultNotice
          result={bulkResult()!.result}
          action={bulkResult()!.action}
          onDismiss={() => setBulkResult(null)}
        />
      </Show>

      <Show when={selectedCount() > 0}>
        <div class="bulk-bar" role="region" aria-label="Bulk actions">
          <span class="bulk-bar__count">
            {selectAllMatching()
              ? `All ${total().toLocaleString('en-US')} agents selected`
              : `${selectedCount()} selected`}
          </span>
          <Show when={canSelectAllMatching()}>
            <button type="button" class="bulk-bar__link" onClick={() => setSelectAllMatching(true)}>
              Select all {total().toLocaleString('en-US')} agents
            </button>
          </Show>
          <button
            type="button"
            class="btn btn--outline btn--sm"
            onClick={() => setProjectsEditorOpen(true)}
          >
            Projects
          </button>
          <button type="button" class="btn btn--outline btn--sm" onClick={() => setCopyOpen(true)}>
            Copy settings from…
          </button>
          <span class="list-toolbar__spacer" />
          <button type="button" class="bulk-bar__link" onClick={clearSelection}>
            Clear selection
          </button>
        </div>
      </Show>

      <Show
        when={data.state === 'errored' || loaded() !== undefined || !data.loading}
        fallback={
          <div class="panel" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th />
                  <th>Agent</th>
                  <th>Owner</th>
                  <th>Projects</th>
                  <th>Models</th>
                  <th>Spend 30d</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                <For each={[1, 2, 3, 4, 5]}>
                  {() => (
                    <tr>
                      <td />
                      <td>
                        <div class="skeleton skeleton--text" style="width: 140px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 100px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 80px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 50px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 60px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 60px; height: 14px;" />
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        }
      >
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <Show
            when={rows().length > 0}
            fallback={
              <Show
                when={hasFilters()}
                fallback={
                  <div class="empty-state">
                    <div class="empty-state__title">No agents yet</div>
                    <p>Create an agent to start routing its requests through Manifest.</p>
                    <button
                      class="btn btn--primary btn--sm"
                      style="margin-top: var(--gap-md);"
                      onClick={() => setModalOpen(true)}
                    >
                      New agent
                    </button>
                  </div>
                }
              >
                <div class="panel">
                  <div class="model-filter__empty">
                    <div class="model-filter__empty-title">No agents match these filters</div>
                    <div class="model-filter__empty-hint">
                      Try another search, or include archived agents.
                    </div>
                    <button
                      class="btn btn--outline btn--sm"
                      style="margin-top: var(--gap-md);"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              </Show>
            }
          >
            <div class="panel" style="padding: 0;">
              <div class="data-table-scroll">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width: 36px;">
                        <TriStateCheckbox
                          state={headerState()}
                          onToggle={toggleAllOnPage}
                          label="Select all on this page"
                        />
                      </th>
                      <SortableTh
                        label="Agent"
                        sortKey="agent"
                        activeKey={sortKey()}
                        dir={sortDir()}
                        {...sortProps}
                      />
                      <SortableTh
                        label="Owner"
                        sortKey="owner"
                        activeKey={sortKey()}
                        dir={sortDir()}
                        {...sortProps}
                      />
                      <SortableTh
                        label="Projects"
                        sortKey="projects"
                        activeKey={sortKey()}
                        dir={sortDir()}
                        {...sortProps}
                      />
                      <SortableTh
                        label="Models"
                        sortKey="models"
                        activeKey={sortKey()}
                        dir={sortDir()}
                        {...sortProps}
                      />
                      <SortableTh
                        label="Spend 30d"
                        sortKey="spend_30d"
                        activeKey={sortKey()}
                        dir={sortDir()}
                        defaultDir="desc"
                        {...sortProps}
                      />
                      <SortableTh
                        label="Last used"
                        sortKey="last_used"
                        activeKey={sortKey()}
                        dir={sortDir()}
                        defaultDir="desc"
                        {...sortProps}
                      />
                      <th style="width: 48px;" />
                    </tr>
                  </thead>
                  <tbody>
                    <For each={rows()}>
                      {(row) => {
                        const icon = () => platformIcon(row.agent_platform, row.agent_category);
                        const typeLabel = () =>
                          row.agent_platform && Object.hasOwn(PLATFORM_LABELS, row.agent_platform)
                            ? PLATFORM_LABELS[row.agent_platform as keyof typeof PLATFORM_LABELS]
                            : 'Agent';
                        const hidden = () => row.projects.slice(2);
                        return (
                          <tr>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.display_name}`}
                                checked={selectAllMatching() || selected().has(row.agent_name)}
                                onChange={() => toggleRow(row.agent_name)}
                              />
                            </td>
                            <td>
                              <span class="who">
                                <Show when={icon()}>
                                  <img src={icon()} alt="" class="who__icon" />
                                </Show>
                                <span class="who__text">
                                  <A
                                    href={agentPath(row.agent_name, '')}
                                    class="who__name"
                                    style="text-decoration: none;"
                                  >
                                    {row.display_name}
                                    <Show when={row.archived_at}>
                                      {' '}
                                      <span class="status-badge status-badge--neutral">
                                        Archived
                                      </span>
                                    </Show>
                                  </A>
                                  <span class="who__sub">{typeLabel()}</span>
                                </span>
                              </span>
                            </td>
                            <td>
                              <Show
                                when={row.owner}
                                fallback={<span class="pill-muted">No owner</span>}
                              >
                                <span class="who">
                                  <Avatar name={row.owner!.name} size="sm" />
                                  {row.owner!.name}
                                </span>
                              </Show>
                            </td>
                            <td>
                              <Show
                                when={row.projects.length > 0}
                                fallback={<span class="project-tag project-tag--muted">None</span>}
                              >
                                <span class="tag-list">
                                  <For each={row.projects.slice(0, 2)}>
                                    {(p) => <span class="project-tag">{p.name}</span>}
                                  </For>
                                  <Show when={hidden().length > 0}>
                                    <span
                                      class="project-tag project-tag--muted"
                                      title={hidden()
                                        .map((p) => p.name)
                                        .join(', ')}
                                    >
                                      +{hidden().length}
                                    </span>
                                  </Show>
                                </span>
                              </Show>
                            </td>
                            <td class="num">{modelsLabel(row)}</td>
                            <td class="num">{formatCost(row.spend_30d_usd) ?? '-'}</td>
                            <td class="num num--muted">
                              {row.last_used_at
                                ? (formatTimeAgo(row.last_used_at) ?? 'Never')
                                : 'Never'}
                            </td>
                            <td>
                              <ActionMenu
                                ariaLabel={`Actions for ${row.display_name}`}
                                items={[
                                  {
                                    label: 'Duplicate',
                                    icon: <DuplicateIcon />,
                                    onClick: () => setDuplicateSource(row.agent_name),
                                  },
                                  {
                                    label: row.archived_at ? 'Unarchive' : 'Archive',
                                    icon: <ArchiveIcon />,
                                    onClick: () => void handleArchive(row),
                                  },
                                  {
                                    label: 'Delete',
                                    danger: true,
                                    icon: <DeleteIcon />,
                                    onClick: () => {
                                      setDeleteTarget(row.agent_name);
                                      setDeleteConfirmName('');
                                    },
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={page}
                totalItems={total}
                pageSize={PAGE_SIZE}
                hasNextPage={() => page() * PAGE_SIZE < total()}
                isLoading={() => data.loading}
                onPrevious={() => setSearchParams({ page: String(page() - 1) }, { replace: true })}
                onNext={() => setSearchParams({ page: String(page() + 1) }, { replace: true })}
              />
            </div>
          </Show>
        </Show>
      </Show>

      <AddAgentModal open={modalOpen()} onClose={() => setModalOpen(false)} />
      <DuplicateAgentModal
        open={duplicateSource() !== null}
        sourceName={duplicateSource() ?? ''}
        onClose={() => setDuplicateSource(null)}
        onDuplicated={() => refetch()}
      />
      <BulkProjectsEditor
        open={projectsEditorOpen()}
        selection={selection()}
        selectedCount={selectedCount()}
        onClose={() => setProjectsEditorOpen(false)}
        onApplied={onBulkApplied('Project changes')}
      />
      <CopySettingsModal
        open={copyOpen()}
        selection={selection()}
        selectedCount={selectedCount()}
        onClose={() => setCopyOpen(false)}
        onApplied={onBulkApplied('Copied settings')}
      />

      <Show when={deleteTarget()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeDeleteModal();
          }}
        >
          <div
            class="modal-card"
            style="max-width: 440px;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agents-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="agents-delete-title"
              style="margin: 0 0 var(--gap-md); font-size: var(--font-size-lg);"
            >
              Delete {deleteTarget()}
            </h3>
            <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-md);">
              This will permanently delete the{' '}
              <strong style="color: hsl(var(--foreground));">{deleteTarget()}</strong> agent and all
              its data. This action cannot be undone. Archive it instead to keep its history.
            </p>
            <label
              for="agents-delete-confirm"
              style="display: block; font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-bottom: var(--gap-sm);"
            >
              To confirm, type <strong>"{deleteTarget()}"</strong> below
            </label>
            <input
              id="agents-delete-confirm"
              class="modal-card__input modal-card__input--lg"
              type="text"
              value={deleteConfirmName()}
              onInput={(e) => setDeleteConfirmName(e.currentTarget.value)}
              placeholder={deleteTarget() ?? ''}
              style="margin-bottom: var(--gap-lg);"
            />
            <div class="modal-card__footer">
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                onClick={closeDeleteModal}
                disabled={deleting()}
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn--danger btn--sm"
                onClick={handleDelete}
                disabled={deleteConfirmName() !== deleteTarget() || deleting()}
              >
                {deleting() ? <span class="spinner" /> : 'Delete agent'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Agents;
