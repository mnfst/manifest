import { Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { NotificationRule } from '../services/api.js';
import { formatThreshold, PERIOD_LABELS } from './LimitRuleTable.js';
import { t } from '../i18n/index.js';

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
              {t('limit.edit')}
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
              {t('limit.delete')}
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
          <h2 class="modal-card__title" id="delete-rule-modal-title">
            {t('limit.deleteRule')}
          </h2>
          <p class="modal-card__desc">
            {t('limit.deleteDescription', {
              metric:
                props.target!.metric_type === 'tokens' ? t('limit.tokenRule') : t('limit.costRule'),
              threshold: formatThreshold(props.target!),
              period: (
                {
                  hour: t('limit.perHour'),
                  day: t('limit.perDay'),
                  week: t('limit.perWeek'),
                  month: t('limit.perMonth'),
                }[props.target!.period] ??
                PERIOD_LABELS[props.target!.period] ??
                props.target!.period
              ).toLocaleLowerCase(),
            })}
          </p>

          <label class="confirm-modal__confirm-row">
            <input
              type="checkbox"
              checked={props.confirmed}
              onChange={(e) => props.onConfirmChange(e.currentTarget.checked)}
            />
            {t('limit.irreversible')}
          </label>

          <div class="confirm-modal__footer">
            <button class="btn btn--ghost btn--sm" onClick={props.onCancel}>
              {t('components.cancel')}
            </button>
            <button
              class="btn btn--danger btn--sm"
              disabled={!props.confirmed || props.deleting}
              onClick={props.onDelete}
            >
              {props.deleting ? <span class="spinner" /> : t('limit.deleteRule')}
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
          <h2 class="modal-card__title" id="remove-provider-modal-title">
            {t('limit.removeProvider')}
          </h2>
          <p class="modal-card__desc">
            {t('limit.removeProviderDescription')}
            <Show when={props.hasEmailRules}> {t('limit.emailPaused')}</Show>
          </p>

          <div class="confirm-modal__footer">
            <button class="btn btn--ghost btn--sm" onClick={props.onCancel}>
              {t('components.cancel')}
            </button>
            <button
              class="btn btn--danger btn--sm"
              onClick={props.onRemove}
              disabled={props.removing}
            >
              {props.removing ? <span class="spinner" /> : t('limit.remove')}
            </button>
          </div>
        </div>
      </div>
    </Show>
  </Portal>
);

export { KebabMenu, DeleteRuleModal, RemoveProviderModal };
