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
 * header (name, role editable in place), tabs, then the child route.
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

  // An errored resource throws on read; this accessor reads only when safe.
  const loadedUser = () => (user.error ? undefined : user());

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

  // ── Inline edit (role) ─────────────────────────────────────────────
  const [editing, setEditing] = createSignal<'role' | null>(null);
  const [draft, setDraft] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const openEdit = (field: 'role') => {
    setDraft(loadedUser()?.role ?? '');
    setEditing(field);
  };

  const saveEdit = async () => {
    const field = editing();
    if (!field) return;
    setSaving(true);
    try {
      await updateUser(userId(), { role: draft().trim() || null });
      toast.success('Role updated');
      setEditing(null);
      refetchUser();
    } catch {
      toast.error("Couldn't save this change. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
                </div>
              </div>

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
