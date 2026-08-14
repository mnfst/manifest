import { For, Show, type Component } from 'solid-js';
import type { NotificationLog } from '../services/api.js';

function formatValue(log: NotificationLog, field: 'actual_value' | 'threshold_value'): string {
  const val = Number(log[field]);
  if (log.metric_type === 'cost') return `$${val.toFixed(2)}`;
  return `${val.toLocaleString()} tokens`;
}

function formatDate(dateStr: string): string {
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  return d.toLocaleDateString(undefined, {
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
    <div class="panel__title">History</div>
    <Show
      when={!props.loading}
      fallback={
        <table class="notif-table notif-table--flush">
          <thead>
            <tr>
              <th>Date</th>
              <th>Usage</th>
              <th>Threshold</th>
              <th>Resets at</th>
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
            <div class="empty-state__title">No alerts triggered yet</div>
          </div>
        }
      >
        <table class="notif-table notif-table--flush">
          <thead>
            <tr>
              <th>Date</th>
              <th>Usage</th>
              <th>Threshold</th>
              <th>Resets at</th>
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
