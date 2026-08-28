import { A, useLocation, useParams } from '@solidjs/router';
import {
  createContext,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  Show,
  useContext,
  type Accessor,
  type ParentComponent,
  type Resource,
} from 'solid-js';
import { Title } from '@solidjs/meta';
import Avatar from '../components/Avatar.jsx';
import EntityTabs from '../components/EntityTabs.jsx';
import ErrorState from '../components/ErrorState.jsx';
import {
  getUser,
  getUserOverview,
  updateUser,
  type TeamUser,
  type UserOverview,
} from '../services/api/teams.js';
import { clearBreadcrumb, setBreadcrumb } from '../services/breadcrumb-store.js';
import { userPath } from '../services/routing.js';
import { budgetLabel, budgetState, parseBudgetInput } from '../services/teams-utils.js';
import { toast } from '../services/toast-store.js';

export interface UserDetailContextValue {
  userId: Accessor<string>;
  user: Resource<TeamUser | null | undefined>;
  /**
   * The overview resource itself, so tabs can tell loading from failure:
   * `overview.loading`, `overview.error`, and `overview()` once ready. Reading
   * `overview()` while it is errored throws, so check `overview.error` first.
   */
  overview: Resource<UserOverview | undefined>;
  refetchUser: () => void;
  refetchOverview: () => void;
}

const UserDetailContext = createContext<UserDetailContextValue>();

export function useUserDetail(): UserDetailContextValue {
  const ctx = useContext(UserDetailContext);
  if (!ctx) throw new Error('useUserDetail must be used inside UserDetail');
  return ctx;
}

/**
 * UserDetail — tabbed shell for a user's page, built like an agent's page:
 * header (name, role, budget, editable in place), tabs, then the child route.
 */
const UserDetail: ParentComponent = (props) => {
  const params = useParams<{ userId: string }>();
  const location = useLocation();
  const userId = () => decodeURIComponent(params.userId);
  const path = (sub: string) => userPath(params.userId, sub);

  const [user, { refetch: refetchUser }] = createResource(
    () => userId(),
    (id) => getUser(id),
  );
  const [overview, { refetch: refetchOverview }] = createResource(
    () => userId(),
    (id) => getUserOverview(id),
  );

  // Errored resources throw on read; these accessors read only when safe.
  const loadedUser = () => (user.error ? undefined : user());
  const loadedOverview = () => (overview.error ? undefined : overview());

  createEffect(() => {
    const u = loadedUser();
    if (u) setBreadcrumb([{ label: 'Users', href: '/users' }], { label: u.name });
  });
  onCleanup(() => clearBreadcrumb());

  const isActive = (sub: string) => {
    if (sub === '' || sub === '/overview') {
      return location.pathname === path('') || location.pathname === path('/overview');
    }
    return location.pathname.startsWith(path(sub));
  };

  // ── Inline edits (role, budget) ────────────────────────────────────
  const [editing, setEditing] = createSignal<'role' | 'budget' | null>(null);
  const [draft, setDraft] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const openEdit = (field: 'role' | 'budget') => {
    const u = loadedUser();
    setDraft(
      field === 'role'
        ? (u?.role ?? '')
        : u?.monthly_budget_usd == null
          ? ''
          : String(u.monthly_budget_usd),
    );
    setEditing(field);
  };

  const draftBudget = () => parseBudgetInput(draft());
  // A zero budget would display as "$0" while every meter treats it as no budget.
  const draftInvalid = () => editing() === 'budget' && draftBudget() === undefined;

  const saveEdit = async () => {
    const field = editing();
    if (!field || draftInvalid()) return;
    setSaving(true);
    try {
      await updateUser(
        userId(),
        field === 'role'
          ? { role: draft().trim() || null }
          : { monthly_budget_usd: draftBudget() ?? null },
      );
      toast.success(field === 'role' ? 'Role updated' : 'Budget updated');
      setEditing(null);
      refetchUser();
      refetchOverview();
    } catch {
      toast.error("Couldn't save this change. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const budget = () => loadedUser()?.monthly_budget_usd ?? null;
  const spend = () => loadedOverview()?.cost_month_usd ?? 0;
  const alertTone = () => budgetState(spend(), budget()).tone;

  const ctx: UserDetailContextValue = {
    userId,
    user,
    overview,
    refetchUser: () => void refetchUser(),
    refetchOverview: () => void refetchOverview(),
  };

  return (
    <UserDetailContext.Provider value={ctx}>
      <div class="container--lg">
        <Title>{loadedUser()?.name ?? 'User'} | Manifest</Title>

        <Show
          when={!user.error}
          fallback={
            <ErrorState
              error={user.error}
              title="Couldn't load this user"
              onRetry={() => void refetchUser()}
            />
          }
        >
          <Show when={!(user.state === 'ready' && user() === null)}>
            <Show when={user()}>
              <div class="entity-header">
                <Avatar name={user()!.name} size="lg" />
                <h1 class="page-header__title entity-header__title">{user()!.name}</h1>
                <div class="entity-header__chips">
                  <Show when={user()!.archived_at}>
                    <span class="status-badge status-badge--neutral">Archived</span>
                  </Show>

                  <div class="inline-edit">
                    <button
                      type="button"
                      class="chip chip--button"
                      aria-haspopup="dialog"
                      aria-expanded={editing() === 'role'}
                      onClick={() => (editing() === 'role' ? setEditing(null) : openEdit('role'))}
                    >
                      <Show
                        when={user()!.role}
                        fallback={<span class="chip__muted">Add a role</span>}
                      >
                        {user()!.role}
                      </Show>
                    </button>
                    <Show when={editing() === 'role'}>
                      <div class="inline-edit__popover" role="dialog" aria-label="Edit role">
                        <label class="modal-card__field-label" for="user-role-edit">
                          Role
                        </label>
                        <input
                          id="user-role-edit"
                          class="modal-card__input"
                          type="text"
                          value={draft()}
                          onInput={(e) => setDraft(e.currentTarget.value)}
                          disabled={saving()}
                        />
                        <div class="inline-edit__actions">
                          <button
                            type="button"
                            class="btn btn--ghost btn--sm"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            class="btn btn--primary btn--sm"
                            disabled={saving()}
                            onClick={() => void saveEdit()}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </Show>
                  </div>

                  <div class="inline-edit">
                    <button
                      type="button"
                      class="chip chip--button"
                      aria-haspopup="dialog"
                      aria-expanded={editing() === 'budget'}
                      onClick={() =>
                        editing() === 'budget' ? setEditing(null) : openEdit('budget')
                      }
                    >
                      <Show
                        when={budget() != null}
                        fallback={<span class="chip__muted">No budget</span>}
                      >
                        Budget ${budget()} / month
                      </Show>
                    </button>
                    <Show when={editing() === 'budget'}>
                      <div class="inline-edit__popover" role="dialog" aria-label="Edit budget">
                        <label class="modal-card__field-label" for="user-budget-edit">
                          Monthly budget in USD
                        </label>
                        <input
                          id="user-budget-edit"
                          class="modal-card__input"
                          classList={{ 'modal-card__input--error': draftInvalid() }}
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft()}
                          onInput={(e) => setDraft(e.currentTarget.value)}
                          disabled={saving()}
                        />
                        <Show
                          when={draftInvalid()}
                          fallback={
                            <span class="field__hint">
                              Changing a budget mid-month recomputes the meter from the first of the
                              month. Leave empty for no budget.
                            </span>
                          }
                        >
                          <span class="field__error">
                            Enter a positive amount, or leave empty for no budget
                          </span>
                        </Show>
                        <div class="inline-edit__actions">
                          <button
                            type="button"
                            class="btn btn--ghost btn--sm"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            class="btn btn--primary btn--sm"
                            disabled={saving() || draftInvalid()}
                            onClick={() => void saveEdit()}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>

              <Show when={alertTone() === 'warn' || alertTone() === 'over'}>
                <div
                  class="budget-alert"
                  classList={{ 'budget-alert--over': alertTone() === 'over' }}
                  role="status"
                >
                  <Show
                    when={alertTone() === 'over'}
                    fallback={
                      <span>
                        {user()!.name} is close to their budget: {budgetLabel(spend(), budget())}{' '}
                        this month. Nothing is blocked.
                      </span>
                    }
                  >
                    <span>
                      {user()!.name} is over budget by{' '}
                      {budgetLabel(spend(), budget())!.replace(' over', '')} this month. Their
                      agents keep working; nothing is blocked.
                    </span>
                  </Show>
                </div>
              </Show>

              <EntityTabs
                tabs={[
                  { label: 'Overview', href: path(''), active: isActive('/overview') },
                  { label: 'Agents', href: path('/agents'), active: isActive('/agents') },
                  {
                    label: 'Model access',
                    href: path('/model-access'),
                    active: isActive('/model-access'),
                  },
                  { label: 'Settings', href: path('/settings'), active: isActive('/settings') },
                ]}
              />

              {props.children}
            </Show>
          </Show>

          <Show when={user.state === 'ready' && user() === null}>
            <div class="empty-state">
              <div class="empty-state__title">User not found</div>
              <p>This user may have been deleted. Old reports still resolve their name.</p>
              <A
                href="/users"
                class="btn btn--outline btn--sm"
                style="margin-top: var(--gap-md); text-decoration: none;"
              >
                Back to Users
              </A>
            </div>
          </Show>
        </Show>
      </div>
    </UserDetailContext.Provider>
  );
};

export default UserDetail;
