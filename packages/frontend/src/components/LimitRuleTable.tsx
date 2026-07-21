import { For, Show, type Component } from 'solid-js';
import AlertIcon from './AlertIcon.js';
import LimitIcon from './LimitIcon.js';
import type { NotificationRule } from '../services/api.js';
import { formatNumber, localeTag, t, tp } from '../i18n/index.js';

function formatThreshold(rule: NotificationRule): string {
  if (rule.metric_type === 'cost') {
    return formatNumber(Number(rule.threshold), {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return tp('limit.tokens', Number(rule.threshold));
}

const PERIOD_LABEL_KEYS = {
  hour: 'limit.perHour',
  day: 'limit.perDay',
  week: 'limit.perWeek',
  month: 'limit.perMonth',
} as const;

// Stable English labels remain exported for consumers that use these values
// as non-UI metadata; rendered UI goes through periodLabel().
const PERIOD_LABELS: Record<string, string> = {
  hour: 'Per hour',
  day: 'Per day',
  week: 'Per week',
  month: 'Per month',
};

function periodLabel(period: string): string {
  const key = PERIOD_LABEL_KEYS[period as keyof typeof PERIOD_LABEL_KEYS];
  return key ? t(key) : period;
}

interface LimitRuleTableProps {
  rules: NotificationRule[] | undefined;
  loading: boolean;
  hasProvider: boolean;
  onToggleMenu: (ruleId: string, e: MouseEvent) => void;
}

const hasEmailAction = (action: string) => action === 'notify' || action === 'both';
const hasBlockAction = (action: string) => action === 'block' || action === 'both';

const LimitRuleTable: Component<LimitRuleTableProps> = (props) => (
  <div class="panel">
    <div class="panel__title">{t('limit.rules')}</div>
    <Show
      when={!props.loading}
      fallback={
        <table class="notif-table notif-table--flush">
          <thead>
            <tr>
              <th>{t('limit.type')}</th>
              <th>{t('limit.threshold')}</th>
              <th>{t('limit.triggered')}</th>
              <th style="text-align: right;">{t('components.actions')}</th>
            </tr>
          </thead>
          <tbody>
            <For each={[1, 2, 3]}>
              {() => (
                <tr>
                  <td>
                    <div class="skeleton skeleton--text" style="width: 28px;" />
                  </td>
                  <td>
                    <div class="skeleton skeleton--text" style="width: 80px;" />
                  </td>
                  <td>
                    <div class="skeleton skeleton--text" style="width: 20px;" />
                  </td>
                  <td style="text-align: right;">
                    <div class="skeleton skeleton--text" style="width: 16px; margin-left: auto;" />
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      }
    >
      <Show
        when={(props.rules ?? []).length > 0}
        fallback={
          <div class="empty-state">
            <div class="empty-state__title">{t('limit.noRules')}</div>
            <p>{t('limit.emptyDescription')}</p>
          </div>
        }
      >
        <table class="notif-table notif-table--flush">
          <thead>
            <tr>
              <th>{t('limit.type')}</th>
              <th>{t('limit.threshold')}</th>
              <th>{t('limit.triggered')}</th>
              <th style="text-align: right;">{t('components.actions')}</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.rules}>
              {(rule) => (
                <tr classList={{ 'notif-table__row--disabled': !rule.is_active }}>
                  <td>
                    <div class="limit-type-icons">
                      <Show when={hasEmailAction(rule.action ?? 'notify')}>
                        <span class="limit-type-icon" title={t('limit.emailAlert')}>
                          <AlertIcon size={14} />
                        </span>
                      </Show>
                      <Show when={hasBlockAction(rule.action ?? 'notify')}>
                        <span class="limit-type-icon" title={t('limit.hardLimit')}>
                          <LimitIcon size={14} />
                        </span>
                      </Show>
                      <Show when={hasEmailAction(rule.action ?? 'notify') && !props.hasProvider}>
                        <span class="limit-warn-tag">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          {t('limit.noProvider')}
                        </span>
                      </Show>
                    </div>
                  </td>
                  <td>
                    <span class="notif-table__mono">{formatThreshold(rule)}</span>{' '}
                    <span class="notif-table__period">
                      {periodLabel(rule.period).toLocaleLowerCase(localeTag())}
                    </span>
                  </td>
                  <td class="notif-table__mono">{rule.trigger_count ?? 0}</td>
                  <td>
                    <div class="notif-table__actions">
                      <button
                        class="rule-menu__btn"
                        onClick={(e) => props.onToggleMenu(rule.id, e)}
                        aria-label={t('limit.ruleOptions')}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </Show>
  </div>
);

export { formatThreshold, periodLabel, PERIOD_LABELS };
export default LimitRuleTable;
