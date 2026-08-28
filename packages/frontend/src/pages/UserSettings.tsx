import { useNavigate } from '@solidjs/router';
import { createEffect, createSignal, Show, type Component } from 'solid-js';
import DeleteUserModal from '../components/DeleteUserModal.jsx';
import { archiveUser, unarchiveUser, updateUser } from '../services/api/teams.js';
import { parseBudgetInput } from '../services/teams-utils.js';
import { toast } from '../services/toast-store.js';
import { useUserDetail } from './UserDetail.jsx';

/**
 * A user's settings: profile fields, archive (hidden everywhere by default,
 * history stays), and the delete flow that decides what happens to their agents.
 */
const UserSettings: Component = () => {
  const { user, overview, userId, refetchUser, refetchOverview } = useUserDetail();
  const navigate = useNavigate();

  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [role, setRole] = createSignal('');
  const [budget, setBudget] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [archiving, setArchiving] = createSignal(false);
  const [deleteOpen, setDeleteOpen] = createSignal(false);

  createEffect(() => {
    const u = user();
    if (!u) return;
    setName(u.name);
    setEmail(u.email ?? '');
    setRole(u.role ?? '');
    setBudget(u.monthly_budget_usd == null ? '' : String(u.monthly_budget_usd));
  });

  /**
   * Live (non-archived) agents still owned by this user, for the delete flow.
   * `null` while the overview is loading or failed: the modal waits rather
   * than assuming zero.
   */
  const liveAgentCount = (): number | null => {
    if (overview.error || overview.loading || overview() === undefined) return null;
    return overview()!.agents.filter((a) => !a.archived_at).length;
  };

  const budgetValue = () => parseBudgetInput(budget());
  // parseBudgetInput already rejects zero, negatives and out-of-range values.
  const budgetInvalid = () => budgetValue() === undefined;
  const canSave = () => name().trim().length > 0 && !budgetInvalid() && !saving();

  const save = async () => {
    if (!canSave()) return;
    setSaving(true);
    try {
      await updateUser(userId(), {
        name: name().trim(),
        email: email().trim() || null,
        role: role().trim() || null,
        monthly_budget_usd: budgetValue() ?? null,
      });
      toast.success('User updated');
      refetchUser();
      // The overview carries the budget the meter and chart read.
      refetchOverview();
    } catch {
      toast.error("Couldn't save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    const u = user();
    if (!u || archiving()) return;
    setArchiving(true);
    try {
      if (u.archived_at) {
        await unarchiveUser(u.id);
        toast.success(`${u.name} restored`);
      } else {
        await archiveUser(u.id);
        toast.success(`${u.name} archived`);
      }
      refetchUser();
    } catch {
      toast.error("Couldn't change the archive state. Please try again.");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Show when={user()}>
      <h2 class="settings-section__title">Profile</h2>
      <div class="settings-card">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Name</span>
            <span class="settings-card__label-desc">
              Renaming keeps their history under the new name.
            </span>
          </div>
          <div class="settings-card__control">
            <input
              class="settings-card__input"
              type="text"
              aria-label="Name"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              disabled={saving()}
            />
          </div>
        </div>
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Email</span>
            <span class="settings-card__label-desc">
              Optional. Only needed if they should receive their own budget alerts.
            </span>
          </div>
          <div class="settings-card__control">
            <input
              class="settings-card__input"
              type="email"
              aria-label="Email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              disabled={saving()}
            />
          </div>
        </div>
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Role</span>
            <span class="settings-card__label-desc">Shown under their name.</span>
          </div>
          <div class="settings-card__control">
            <input
              class="settings-card__input"
              type="text"
              aria-label="Role"
              value={role()}
              onInput={(e) => setRole(e.currentTarget.value)}
              disabled={saving()}
            />
          </div>
        </div>
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Monthly budget (USD)</span>
            <span class="settings-card__label-desc">
              Shows spend and raises an alert as it is approached or exceeded. Nothing is blocked.
              Changing it mid-month recomputes the meter from the first of the month.
            </span>
            <Show when={budgetInvalid()}>
              <span class="field__error">
                Enter a positive amount, or leave empty for no budget
              </span>
            </Show>
          </div>
          <div class="settings-card__control">
            <input
              class="settings-card__input"
              type="number"
              min="0"
              step="0.01"
              aria-label="Monthly budget"
              value={budget()}
              onInput={(e) => setBudget(e.currentTarget.value)}
              disabled={saving()}
            />
          </div>
        </div>
        <div class="settings-card__footer">
          <button
            type="button"
            class="btn btn--primary btn--sm"
            disabled={!canSave()}
            onClick={() => void save()}
          >
            {saving() ? <span class="spinner" /> : 'Save'}
          </button>
        </div>
      </div>

      <h2 class="settings-section__title">Archive</h2>
      <div class="settings-card">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">
              {user()!.archived_at ? 'This user is archived' : 'Archive this user'}
            </span>
            <span class="settings-card__label-desc">
              Archived users are hidden everywhere by default. Nothing is lost: their agents and
              history stay attributed to them, and "Include archived" brings them back.
            </span>
          </div>
          <div class="settings-card__control settings-card__control--end">
            <button
              type="button"
              class="btn btn--outline btn--sm"
              disabled={archiving()}
              onClick={() => void toggleArchive()}
            >
              {archiving() ? <span class="spinner" /> : user()!.archived_at ? 'Restore' : 'Archive'}
            </button>
          </div>
        </div>
      </div>

      <h2 class="settings-section__title">Danger zone</h2>
      <div class="settings-card settings-card--danger">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Delete this user</span>
            <span class="settings-card__label-desc">
              Blocked while they still own agents, unless you choose what happens to those agents.
              Past activity keeps their name.
            </span>
          </div>
          <div class="settings-card__control settings-card__control--end">
            <button
              type="button"
              class="btn btn--danger btn--sm"
              onClick={() => setDeleteOpen(true)}
            >
              Delete user
            </button>
          </div>
        </div>
      </div>

      <DeleteUserModal
        open={deleteOpen()}
        user={user()!}
        agentCount={liveAgentCount()}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          navigate('/users', { replace: true });
        }}
      />
    </Show>
  );
};

export default UserSettings;
