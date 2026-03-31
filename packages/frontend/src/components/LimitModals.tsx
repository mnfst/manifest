import { Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { NotificationRule } from '../services/api.js';
import { formatThreshold, PERIOD_LABELS } from './LimitRuleTable.js';

interface KebabMenuProps {
  openMenuId: string | null;
  menuPos: { top: number; left: number };
  rules: NotificationRule[];
  onEdit: (rule: NotificationRule) => void;
  onDelete: (rule: NotificationRule) => void;
}

const KebabMenu: Component<KebabMenuProps> = (props) => (
  <Portal>
    <Show when={props.openMenuId}>
      {(_id) => {
        const rule = props.rules.find((r) => r.id === props.openMenuId);
        if (!rule) return null;
        return (
          <div
            class="rule-menu__dropdown"
            role="menu"
            style={{
              position: 'fixed',
              top: `${props.menuPos.top}px`,
              left: `${props.menuPos.left}px`,
              transform: 'translateX(-100%)',
            }}
          >
            <button class="rule-menu__item" role="menuitem" onClick={() => props.onEdit(rule)}>
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
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              class="rule-menu__item rule-menu__item--danger"
              role="menuitem"
              onClick={() => props.onDelete(rule)}
            >
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
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
          </div>
        );
      }}
    </Show>
  </Portal>
);

interface DeleteRuleModalProps {
  target: NotificationRule | null;
  confirmed: boolean;
  deleting: boolean;
  onConfirmChange: (checked: boolean) => void;
  onCancel: () => void;
  onDelete: () => void;
}

const DeleteRuleModal: Component<DeleteRuleModalProps> = (props) => (
  <Portal>
    <Show when={props.target}>
      <div class="modal-overlay" onClick={props.onCancel}>
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-rule-modal-title"
          style="max-width: 440px;"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="delete-rule-modal-title">Delete rule</h2>
          <p class="modal-card__desc">
            This will permanently delete the{' '}
            <span style="font-weight: 600;">
              {props.target!.metric_type === 'tokens' ? 'token' : 'cost'}
            </span>{' '}
            rule ({formatThreshold(props.target!)}{' '}
            {PERIOD_LABELS[props.target!.period]?.toLowerCase() ?? props.target!.period}). This
            action cannot be undone.
          </p>

          <label class="confirm-modal__confirm-row">
            <input
              type="checkbox"
              checked={props.confirmed}
              onChange={(e) => props.onConfirmChange(e.currentTarget.checked)}
            />
            I understand this action is irreversible
          </label>

          <div class="confirm-modal__footer">
            <button class="btn btn--ghost btn--sm" onClick={props.onCancel}>
              Cancel
            </button>
            <button
              class="btn btn--danger btn--sm"
              disabled={!props.confirmed || props.deleting}
              onClick={props.onDelete}
            >
              {props.deleting ? <span class="spinner" /> : 'Delete rule'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  </Portal>
);

interface RemoveProviderModalProps {
  open: boolean;
  hasEmailRules: boolean;
  removing: boolean;
  onCancel: () => void;
  onRemove: () => void;
}

const RemoveProviderModal: Component<RemoveProviderModalProps> = (props) => (
  <Portal>
    <Show when={props.open}>
      <div class="modal-overlay" onClick={props.onCancel}>
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-provider-modal-title"
          style="max-width: 440px;"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="remove-provider-modal-title">Remove provider</h2>
          <p class="modal-card__desc">
            This will disconnect your email provider.
            <Show when={props.hasEmailRules}>
              {' '}
              Email alerts won't be sent until you set up a new one.
            </Show>
          </p>

          <div class="confirm-modal__footer">
            <button class="btn btn--ghost btn--sm" onClick={props.onCancel}>
              Cancel
            </button>
            <button
              class="btn btn--danger btn--sm"
              onClick={props.onRemove}
              disabled={props.removing}
            >
              {props.removing ? <span class="spinner" /> : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  </Portal>
);

export { KebabMenu, DeleteRuleModal, RemoveProviderModal };
