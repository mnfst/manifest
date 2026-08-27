import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import ErrorState from '../components/ErrorState.jsx';
import FilterCheckbox from '../components/FilterCheckbox.jsx';
import AvatarStack from '../components/AvatarStack.jsx';
import Sparkline from '../components/Sparkline.jsx';
import ProjectModal from '../components/ProjectModal.jsx';
import { getProjects, type ProjectRow } from '../services/api/teams.js';
import { formatNumber } from '../services/formatters.js';
import {
  currentMonthLabel,
  downloadTextFile,
  formatMoney,
  toCsv,
} from '../services/teams-utils.js';
import { projectPath } from '../services/routing.js';
import { analyticsPing } from '../services/sse.js';
import '../styles/model-filter.css';

const SHARED_TITLE =
  'At least one agent on this project also carries another project. Its cost is counted in each project it carries; no split is invented.';

/**
 * Projects list: one row per project with agents, users (a stack of avatars
 * ordered by most recent activity), a 7-day request sparkline, spend this
 * month and last month. Export CSV for finance.
 */
const Projects: Component = () => {
  const [searchParams, setSearchParams] = useSearchParams<{ q?: string; archived?: string }>();
  const [search, setSearch] = createSignal(
    typeof searchParams.q === 'string' ? searchParams.q : '',
  );
  const [includeArchived, setIncludeArchived] = createSignal(searchParams.archived === 'true');
  const [modalOpen, setModalOpen] = createSignal(false);

  const updateSearch = (value: string) => {
    setSearch(value);
    setSearchParams({ q: value || undefined }, { replace: true });
  };
  const updateArchived = (value: boolean) => {
    setIncludeArchived(value);
    setSearchParams({ archived: value ? 'true' : undefined }, { replace: true });
  };

  const [data, { refetch }] = createResource(
    () => ({ search: search(), include_archived: includeArchived(), _p: analyticsPing() }),
    (q) => getProjects({ search: q.search, include_archived: q.include_archived }),
  );

  // Reading an errored resource throws, so guard on state before the read.
  const loaded = () => (data.state === 'ready' || data.state === 'refreshing' ? data() : undefined);
  const rows = () => loaded()?.projects ?? [];
  const isFiltered = () => search() !== '' || includeArchived();
  // Keep the table on screen during SSE refreshes; only the first load skeletons.
  const settled = () =>
    data.state === 'ready' || data.state === 'refreshing' || data.state === 'errored';

  const exportCsv = () => {
    const csv = toCsv(
      [
        'Project',
        'Description',
        'Agents',
        'Users',
        'Requests 7d',
        'Spend this month',
        'Last month',
        'Cost counted in each project',
      ],
      rows().map((row) => [
        row.name,
        row.description,
        row.agent_count,
        row.users.length,
        row.requests_7d_total,
        row.spend_month_usd.toFixed(2),
        row.spend_last_month_usd.toFixed(2),
        row.spend_shared ? 'yes' : 'no',
      ]),
    );
    downloadTextFile(`projects-${new Date().toISOString().slice(0, 7)}.csv`, csv);
  };

  const sparkLabels = (row: ProjectRow) =>
    `${formatNumber(row.requests_7d_total)} requests in the last 7 days`;

  return (
    <div class="container--lg">
      <Title>Projects - Manifest</Title>
      <Meta
        name="description"
        content="Cost every client and workstream. One row per project with its agents, users and spend."
      />
      <div class="page-header">
        <div>
          <h1>Projects</h1>
          <span class="breadcrumb">
            <Show when={loaded()} fallback={currentMonthLabel()}>
              {loaded()!.total} project{loaded()!.total === 1 ? '' : 's'} · {currentMonthLabel()}
            </Show>
          </span>
        </div>
        <div class="header-controls">
          <button
            type="button"
            class="btn btn--outline btn--sm"
            onClick={exportCsv}
            disabled={rows().length === 0}
          >
            Export CSV
          </button>
          <button type="button" class="btn btn--primary btn--sm" onClick={() => setModalOpen(true)}>
            New project
          </button>
        </div>
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
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            class="list-search__input"
            type="search"
            placeholder="Search projects"
            aria-label="Search projects"
            value={search()}
            onInput={(e) => updateSearch(e.currentTarget.value)}
          />
        </div>
        <FilterCheckbox
          label="Include archived"
          checked={includeArchived()}
          onChange={updateArchived}
        />
      </div>

      <Show
        when={settled()}
        fallback={
          <div class="panel">
            <div
              class="skeleton skeleton--text"
              style="width: 30%; height: 16px; margin-bottom: 12px;"
            />
            <div class="skeleton skeleton--rect" style="width: 100%; height: 120px;" />
          </div>
        }
      >
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <Show
            when={rows().length > 0}
            fallback={
              <Show
                when={isFiltered()}
                fallback={
                  <div class="empty-state">
                    <div class="empty-state__title">No projects yet</div>
                    <p>
                      A project is a tag an agent carries, so a client or a workstream can be
                      costed.
                    </p>
                    <button
                      type="button"
                      class="btn btn--primary btn--sm"
                      style="margin-top: var(--gap-md);"
                      onClick={() => setModalOpen(true)}
                    >
                      New project
                    </button>
                  </div>
                }
              >
                <div class="panel">
                  <div class="model-filter__empty">
                    <p class="model-filter__empty-title">No projects match your filters</p>
                    <p class="model-filter__empty-hint">
                      Try another search, or include archived projects.
                    </p>
                    <button
                      type="button"
                      class="btn btn--ghost btn--sm"
                      onClick={() => {
                        updateSearch('');
                        updateArchived(false);
                      }}
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
                      <th>Project</th>
                      <th>Agents</th>
                      <th>Users</th>
                      <th>Last 7 days</th>
                      <th>Spend this month</th>
                      <th>Last month</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={rows()}>
                      {(row) => (
                        <tr>
                          <td>
                            <span class="who">
                              <span class="who__text">
                                <A
                                  href={projectPath(row.id)}
                                  class="who__name"
                                  style="text-decoration: none;"
                                >
                                  {row.name}
                                </A>
                                <Show when={row.description}>
                                  <span class="who__sub">{row.description}</span>
                                </Show>
                              </span>
                              <Show when={row.archived_at}>
                                <span class="status-badge status-badge--neutral">Archived</span>
                              </Show>
                            </span>
                          </td>
                          <td class="num">{row.agent_count}</td>
                          <td>
                            <AvatarStack users={row.users} />
                          </td>
                          <td>
                            <span
                              style="display: inline-flex; align-items: center; gap: var(--gap-sm);"
                              title={sparkLabels(row)}
                            >
                              <Sparkline data={row.requests_7d} width={74} height={22} />
                              <span class="num num--muted">
                                {formatNumber(row.requests_7d_total)}
                              </span>
                            </span>
                          </td>
                          <td class="num">
                            <strong>{formatMoney(row.spend_month_usd)}</strong>
                            <Show when={row.spend_shared}>
                              {' '}
                              <span class="project-tag project-tag--muted" title={SHARED_TITLE}>
                                counted in each project
                              </span>
                            </Show>
                          </td>
                          <td class="num num--muted">{formatMoney(row.spend_last_month_usd)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          </Show>
        </Show>
      </Show>

      <ProjectModal
        open={modalOpen()}
        onClose={() => setModalOpen(false)}
        onSaved={() => void refetch()}
      />
    </div>
  );
};

export default Projects;
