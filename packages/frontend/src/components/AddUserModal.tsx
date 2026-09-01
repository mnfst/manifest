import { createEffect, createSignal, Show, type Component } from 'solid-js';
import { createUser, type TeamUser } from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (user: TeamUser) => void;
}

/**
 * "Add user": a person in the company. They do not log in, so there is no
 * invitation and no password. Name required, email and role optional. The
 * monthly budget is set later from the user's page, not here.
 */
const AddUserModal: Component<AddUserModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [role, setRole] = createSignal('');
  const [creating, setCreating] = createSignal(false);

  const canSubmit = () => name().trim().length > 0 && !creating();

  createEffect(() => {
    if (!props.open) {
      setName('');
      setEmail('');
      setRole('');
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
      });
      toast.success(`User "${user.name}" added`);
      props.onCreated?.(user);
      props.onClose();
    } catch (error) {
      // Say why: "the teams backend is not deployed" is actionable, a generic
      // retry prompt is not.
      const reason = error instanceof Error && error.message ? error.message : null;
      toast.error(reason ? `Couldn't add this user: ${reason}` : "Couldn't add this user.");
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
            A person in the company whose agents you want to track together. They do not log in.
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
