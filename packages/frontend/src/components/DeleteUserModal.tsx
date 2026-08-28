import { A } from '@solidjs/router';
import { createEffect, createSignal, on, Show, type Component } from 'solid-js';
import { deleteUser, type TeamUser } from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';

type AgentChoice = 'unassign' | 'delete';

interface DeleteUserModalProps {
  open: boolean;
  user: TeamUser;
  /** Live agents the user still owns; `null` while that is not known yet. */
  agentCount: number | null;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * Deleting a user is blocked while they still own agents, unless the caller
 * says what happens to those agents: leave them with no user (default) or
 * delete them. While the agent count is unknown the confirm stays disabled,
 * so an unfinished lookup never silently defaults to "unassign".
 *
 * There is deliberately NO "reassign to another user" option. Past activity
 * has to stay attributed to whoever owned the agent when it ran, and a live
 * reassignment forces a decision on the exact moment that split happens. To
 * hand an agent over, archive it and create a fresh one for its new owner with
 * "Copy settings from an agent".
 */
const DeleteUserModal: Component<DeleteUserModalProps> = (props) => {
  const [choice, setChoice] = createSignal<AgentChoice>('unassign');
  const [deleting, setDeleting] = createSignal(false);

  // Reset only when the modal goes from closed to open: a count that arrives
  // or changes while it is open must not undo the person's choice, and must
  // never re-enable the button during an in-flight delete.
  createEffect(
    on(
      () => props.open,
      (open, wasOpen) => {
        if (open && !wasOpen) {
          setChoice('unassign');
          setDeleting(false);
        }
      },
    ),
  );

  const known = () => props.agentCount !== null;
  const canConfirm = () => !deleting() && known();

  const handleDelete = async () => {
    if (!canConfirm()) return;
    setDeleting(true);
    try {
      await deleteUser(props.user.id, { agents: choice() });
      toast.success(`User "${props.user.name}" deleted`);
      props.onDeleted();
    } catch {
      toast.error("Couldn't delete this user. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 480px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="delete-user-title">
            Delete {props.user.name}
          </h2>
          <Show
            when={known()}
            fallback={
              <p class="modal-card__desc" role="status">
                <span class="spinner" /> Checking their agents…
              </p>
            }
          >
            <Show
              when={props.agentCount! > 0}
              fallback={
                <p class="modal-card__desc">
                  {props.user.name} owns no agents. Past activity keeps their name, so old reports
                  stay readable.
                </p>
              }
            >
              <p class="modal-card__desc">
                {props.user.name} still owns {props.agentCount} agent
                {props.agentCount === 1 ? '' : 's'}. Choose what happens to them.
              </p>
              <div class="choice-list" role="radiogroup" aria-label="What happens to their agents">
                <label
                  class="choice-list__item"
                  classList={{ 'choice-list__item--on': choice() === 'unassign' }}
                >
                  <input
                    type="radio"
                    name="delete-user-agents"
                    value="unassign"
                    checked={choice() === 'unassign'}
                    onChange={() => setChoice('unassign')}
                  />
                  <span>
                    Leave their agents with no user
                    <br />
                    <span class="choice-list__desc">
                      They keep running. Their history stays under {props.user.name}.
                    </span>
                  </span>
                </label>
                <label
                  class="choice-list__item"
                  classList={{ 'choice-list__item--on': choice() === 'delete' }}
                >
                  <input
                    type="radio"
                    name="delete-user-agents"
                    value="delete"
                    checked={choice() === 'delete'}
                    onChange={() => setChoice('delete')}
                  />
                  <span>
                    Delete the agents
                    <br />
                    <span class="choice-list__desc">
                      Their API keys stop working and their history is deleted.
                    </span>
                  </span>
                </label>
              </div>
              <p class="field__hint" style="margin-bottom: var(--gap-md);">
                Or manage them on the Agents page first:{' '}
                <A href={`/agents?owners=${encodeURIComponent(props.user.id)}`}>
                  Open Agents filtered by {props.user.name}
                </A>
              </p>
            </Show>
          </Show>

          <div class="modal-card__footer">
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              onClick={props.onClose}
              disabled={deleting()}
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn--danger btn--sm"
              disabled={!canConfirm()}
              onClick={() => void handleDelete()}
            >
              {deleting() ? <span class="spinner" /> : 'Delete user'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default DeleteUserModal;
