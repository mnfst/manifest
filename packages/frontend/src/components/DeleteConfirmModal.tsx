import { createSignal, Show, type Component } from 'solid-js';

export interface DeleteConfirmModalProps {
  /** Display name the user must type to confirm (e.g. agent or tier name). */
  targetName: string;
  /** Dialog title, e.g. `Delete Premium`. */
  title: string;
  /** Body copy shown under the title. */
  description: string;
  /** Label on the destructive button. */
  confirmLabel: string;
  /** `for` / `id` suffix so multiple modals on a page stay unique. */
  inputId?: string;
  deleting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/** Type-to-confirm delete dialog (same pattern as workspace agent delete). */
const DeleteConfirmModal: Component<DeleteConfirmModalProps> = (props) => {
  const [confirmName, setConfirmName] = createSignal('');
  const inputId = () => props.inputId ?? 'delete-confirm';

  const handleClose = () => {
    if (props.deleting) return;
    setConfirmName('');
    props.onClose();
  };

  const handleConfirm = () => {
    if (confirmName() !== props.targetName || props.deleting) return;
    void props.onConfirm();
  };

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose();
      }}
    >
      <div
        class="modal-card"
        style="max-width: 440px;"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId()}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id={`${inputId()}-title`}
          style="margin: 0 0 var(--gap-md); font-size: var(--font-size-lg);"
        >
          {props.title}
        </h3>
        <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-md);">
          {props.description}
        </p>
        <label
          for={inputId()}
          style="display: block; font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-bottom: var(--gap-sm);"
        >
          To confirm, type <strong>"{props.targetName}"</strong> below
        </label>
        <input
          id={inputId()}
          class="modal-card__input modal-card__input--lg"
          type="text"
          value={confirmName()}
          onInput={(e) => setConfirmName(e.currentTarget.value)}
          placeholder={props.targetName}
          style="margin-bottom: var(--gap-lg);"
          data-testid="delete-confirm-input"
        />
        <div class="modal-card__footer">
          <button
            type="button"
            class="btn btn--ghost btn--sm"
            onClick={handleClose}
            disabled={props.deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn--danger btn--sm"
            onClick={handleConfirm}
            disabled={confirmName() !== props.targetName || props.deleting}
            data-testid="delete-confirm-submit"
          >
            <Show when={props.deleting} fallback={props.confirmLabel}>
              <span class="spinner" />
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
