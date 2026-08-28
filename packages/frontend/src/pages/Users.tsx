import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import ErrorState from '../components/ErrorState.jsx';
import Avatar from '../components/Avatar.jsx';
import FilterCheckbox from '../components/FilterCheckbox.jsx';
import SortableTh from '../components/SortableTh.jsx';
import AddUserModal from '../components/AddUserModal.jsx';
import { getUsers, type UserListQuery } from '../services/api/teams.js';
import { formatCost } from '../services/formatters.js';
import { formatMoney } from '../services/teams-utils.js';
import { userPath } from '../services/routing.js';
import '../styles/model-filter.css';

type SortKey = NonNullable<UserListQuery['sort']>;
type SortDir = 'asc' | 'desc';

const isSortKey = (value: unknown): value is SortKey =>
  value === 'name' || value === 'spend_30d' || value === 'spend_365d';

/**
 * Users: one row per person the company tracks spend for. They do not log in.
 * Sortable by spend over the last 30 or 365 days; archived users are hidden unless
 * "Include archived" is on.
 */
const Users: Component = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    q?: string;
    sort?: string;
    dir?: string;
    archived?: string;
  }>();

  const [search, setSearchValue] = createSignal(
    typeof searchParams.q === 'string' ? searchParams.q : '',
  );
  const [sort, setSortValue] = createSignal<SortKey | null>(
    isSortKey(searchParams.sort) ? searchParams.sort : null,
  );
  const [dir, setDirValue] = createSignal<SortDir>(searchParams.dir === 'desc' ? 'desc' : 'asc');
  const [includeArchived, setIncludeArchivedValue] = createSignal(searchParams.archived === '1');
  const [addOpen, setAddOpen] = createSignal(false);

  const setSearch = (value: string) => {
    setSearchValue(value);
    setSearchParams({ q: value || undefined }, { replace: true });
  };
  const setSort = (key: SortKey, direction: SortDir) => {
    setSortValue(key);
    setDirValue(direction);
    setSearchParams({ sort: key, dir: direction }, { replace: true });
  };
  const setIncludeArchived = (value: boolean) => {
    setIncludeArchivedValue(value);
    setSearchParams({ archived: value ? '1' : undefined }, { replace: true });
  };

  const [data, { refetch }] = createResource(
    () => ({
      search: search(),
      include_archived: includeArchived(),
      sort: sort() ?? undefined,
      dir: sort() ? dir() : undefined,
    }),
    (query) => getUsers(query),
  );

  // Reading an errored resource throws, so every read goes through this guard.
  const loaded = () => (data.error ? undefined : data());
  const isFiltered = () => search().trim() !== '' || includeArchived();
  const hasRows = () => (loaded()?.users.length ?? 0) > 0;

  const clearFilters = () => {
    setSearch('');
    setIncludeArchived(false);
  };

  return (
    <div class="container--lg">
      <Title>Users - Manifest</Title>
      <Meta
        name="description"
        content="People in your company, their agents and what they spend."
      />

      <div class="page-header">
        <div>
          <h1>Users</h1>
          <span class="breadcrumb">
            <Show when={loaded()} fallback="People in your company and what their agents cost.">
              {loaded()!.total} user{loaded()!.total === 1 ? '' : 's'} ·{' '}
              {formatMoney(loaded()!.spend_30d_usd_total)} spent in the last 30 days
            </Show>
          </span>
        </div>
        <button class="btn btn--primary btn--sm" onClick={() => setAddOpen(true)}>
          Add user
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
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            class="list-search__input"
            type="search"
            placeholder="Search users"
            aria-label="Search users"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
        <FilterCheckbox
          label="Include archived"
          checked={includeArchived()}
          onChange={setIncludeArchived}
        />
      </div>

      <Show
        when={data.state !== 'pending' && data.state !== 'unresolved'}
        fallback={
          <div class="panel">
            <table class="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Agents</th>
                  <th>Spend (30d)</th>
                  <th>Spend (365d)</th>
                </tr>
              </thead>
              <tbody>
                <For each={[1, 2, 3]}>
                  {() => (
                    <tr>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 140px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 24px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 60px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 50px; height: 14px;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 120px; height: 14px;" />
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
          <Show when={hasRows() || isFiltered()}>
            <Show
              when={hasRows()}
              fallback={
                <div class="panel">
                  <div class="model-filter__empty">
                    <div class="model-filter__empty-title">No users match</div>
                    <div class="model-filter__empty-hint">
                      Try another name, or include archived users.
                    </div>
                    <button class="btn btn--outline btn--sm" onClick={clearFilters}>
                      Clear filters
                    </button>
                  </div>
                </div>
              }
            >
              <div class="panel" style="padding: 0;">
                <div class="data-table-scroll">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Agents</th>
                        <SortableTh
                          label="Spend (30d)"
                          sortKey="spend_30d"
                          activeKey={sort()}
                          dir={dir()}
                          defaultDir="desc"
                          onSort={setSort}
                        />
                        <SortableTh
                          label="Spend (365d)"
                          sortKey="spend_365d"
                          activeKey={sort()}
                          dir={dir()}
                          defaultDir="desc"
                          onSort={setSort}
                        />
                      </tr>
                    </thead>
                    <tbody>
                      <For each={loaded()!.users}>
                        {(user) => (
                          <tr>
                            <td>
                              <span class="who">
                                <Avatar name={user.name} />
                                <A
                                  href={userPath(user.id)}
                                  class="who__name"
                                  style="text-decoration: none;"
                                >
                                  {user.name}
                                </A>
                                <Show when={user.archived_at}>
                                  <span class="status-badge status-badge--neutral">Archived</span>
                                </Show>
                              </span>
                            </td>
                            <td>{user.role || '—'}</td>
                            <td class="num">{user.agent_count}</td>
                            <td class="num">{formatCost(user.spend_30d_usd)}</td>
                            <td class="num">{formatCost(user.spend_365d_usd)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>
          </Show>
          <Show when={!hasRows() && !isFiltered()}>
            <div class="empty-state">
              <div class="empty-state__title">No users yet</div>
              <p>
                On day one every existing agent has no user. Add a user, or pick agents to give them
                one.
              </p>
              <div style="display: inline-flex; gap: var(--gap-sm); margin-top: var(--gap-md);">
                <button class="btn btn--primary btn--sm" onClick={() => setAddOpen(true)}>
                  Add user
                </button>
                <A href="/agents" class="btn btn--outline btn--sm" style="text-decoration: none;">
                  Go to Agents
                </A>
              </div>
            </div>
          </Show>
        </Show>
      </Show>

      <AddUserModal
        open={addOpen()}
        onClose={() => setAddOpen(false)}
        onCreated={() => void refetch()}
      />
    </div>
  );
};

export default Users;
