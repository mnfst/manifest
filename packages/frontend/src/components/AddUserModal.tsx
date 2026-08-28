import { createEffect, createSignal, Show, type Component } from 'solid-js';
import { createUser, type TeamUser } from '../services/api/teams.js';
import { parseBudgetInput } from '../services/teams-utils.js';
import { toast } from '../services/toast-store.js';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (user: TeamUser) => void;
}

/**
 * "Add user": a person in the company with a monthly budget. They do not log
 * in, so there is no invitation and no password. Name required, email optional.
 */
const AddUserModal: Component<AddUserModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [role, setRole] = createSignal('');
  const [budget, setBudget] = createSignal('');
  const [creating, setCreating] = createSignal(false);

  const budgetValue = () => parseBudgetInput(budget());
  // A zero budget would display as "$0" while every meter treats it as no budget.
  const budgetInvalid = () => budgetValue() === undefined || budgetValue() === 0;
  const canSubmit = () => name().trim().length > 0 && !budgetInvalid() && !creating();

  createEffect(() => {
    if (!props.open) {
      setName('');
      setEmail('');
      setRole('');
      setBudget('');
      setCreating(false);
    }
  });

  const handleCreate = async () => {
    if (!canSubmit()) return;
    setCreating(true);
    try {
      const user = await createUser({
        name: name().trim(),
        email: email().trim() || null,
        role: role().trim() || null,
        monthly_budget_usd: budgetValue() ?? null,
      });
      toast.success(`User "${user.name}" added`);
      props.onCreated?.(user);
      props.onClose();
    } catch {
      toast.error("Couldn't add this user. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) void handleCreate();
    if (e.key === 'Escape') props.onClose();
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 480px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <h2 class="modal-card__title" id="add-user-title">
            Add user
          </h2>
          <p class="modal-card__desc">
            A person in the company whose agents share a monthly budget. They do not log in.
          </p>

          <div class="field">
            <label class="modal-card__field-label" for="add-user-name">
              Name
            </label>
            <input
              id="add-user-name"
              class="modal-card__input modal-card__input--lg"
              type="text"
              placeholder="e.g. Maya Okonkwo"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              disabled={creating()}
              ref={(el) => requestAnimationFrame(() => el.focus())}
            />
          </div>

          <div class="field__row">
            <div class="field">
              <label class="modal-card__field-label" for="add-user-email">
                Email (optional)
              </label>
              <input
                id="add-user-email"
                class="modal-card__input"
                type="email"
                placeholder="maya@company.com"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                disabled={creating()}
              />
              <span class="field__hint">
                Only needed if they should receive their own budget alerts.
              </span>
            </div>
            <div class="field">
              <label class="modal-card__field-label" for="add-user-role">
                Role (optional)
              </label>
              <input
                id="add-user-role"
                class="modal-card__input"
                type="text"
                placeholder="e.g. Engineering"
                value={role()}
                onInput={(e) => setRole(e.currentTarget.value)}
                disabled={creating()}
              />
            </div>
          </div>

          <div class="field">
            <label class="modal-card__field-label" for="add-user-budget">
              Monthly budget in USD (optional)
            </label>
            <input
              id="add-user-budget"
              class="modal-card__input"
              classList={{ 'modal-card__input--error': budgetInvalid() }}
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 200"
              value={budget()}
              onInput={(e) => setBudget(e.currentTarget.value)}
              disabled={creating()}
            />
            <Show
              when={budgetInvalid()}
              fallback={
                <span class="field__hint">
                  Shows spend and raises an alert as it is approached or exceeded. Nothing is
                  blocked.
                </span>
              }
            >
              <span class="field__error">
                Enter a positive amount, or leave empty for no budget
              </span>
            </Show>
          </div>

          <div class="modal-card__footer">
            <button type="button" class="btn btn--ghost btn--sm" onClick={props.onClose}>
              Cancel
            </button>
            <button
              type="button"
              class="btn btn--primary btn--sm"
              disabled={!canSubmit()}
              onClick={() => void handleCreate()}
            >
              {creating() ? <span class="spinner" /> : 'Add user'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default AddUserModal;
