import { For, Show, type Component } from 'solid-js';
import type { NotificationLog } from '../services/api.js';
import { formatDateTime, formatNumber, t, tp } from '../i18n/index.js';

function formatValue(log: NotificationLog, field: 'actual_value' | 'threshold_value'): string {
  const val = Number(log[field]);
  if (log.metric_type === 'cost') {
    return formatNumber(val, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return tp('limit.tokens', val);
}

function formatDate(dateStr: string): string {
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  return formatDateTime(d, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  logs: NotificationLog[] | undefined;
  loading: boolean;
}

const LimitHistoryTable: Component<Props> = (props) => (
  <div class="panel">
    <div class="panel__title">{t('limit.history')}</div>
    <Show
      when={!props.loading}
      fallback={
        <table class="notif-table notif-table--flush">
          <thead>
            <tr>
              <th>{t('limit.date')}</th>
              <th>{t('limit.usage')}</th>
              <th>{t('limit.threshold')}</th>
              <th>{t('limit.resetsAt')}</th>
            </tr>
          </thead>
          <tbody>
            <For each={[1, 2, 3]}>
              {() => (
                <tr>
                  <td>
                    <div class="skeleton skeleton--text" style="width: 100px;" />
                  </td>
                  <td>
                    <div class="skeleton skeleton--text" style="width: 60px;" />
                  </td>
                  <td>
                    <div class="skeleton skeleton--text" style="width: 60px;" />
                  </td>
                  <td>
                    <div class="skeleton skeleton--text" style="width: 100px;" />
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      }
    >
      <Show
        when={(props.logs ?? []).length > 0}
        fallback={
          <div class="empty-state">
            <div class="empty-state__title">{t('limit.noAlerts')}</div>
          </div>
        }
      >
        <table class="notif-table notif-table--flush">
          <thead>
            <tr>
              <th>{t('limit.date')}</th>
              <th>{t('limit.usage')}</th>
              <th>{t('limit.threshold')}</th>
              <th>{t('limit.resetsAt')}</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.logs}>
              {(log) => (
                <tr>
                  <td class="notif-table__mono">{formatDate(log.sent_at)}</td>
                  <td class="notif-table__mono">{formatValue(log, 'actual_value')}</td>
                  <td class="notif-table__mono">{formatValue(log, 'threshold_value')}</td>
                  <td class="notif-table__mono">{formatDate(log.period_end)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </Show>
  </div>
);

export default LimitHistoryTable;
