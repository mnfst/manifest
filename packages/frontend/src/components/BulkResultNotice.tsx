import { For, Show, type Component } from 'solid-js';
import type { BulkResult } from '../services/api/teams.js';

interface BulkResultNoticeProps {
  result: BulkResult;
  /** What was attempted, e.g. "Project changes". */
  action: string;
  onDismiss: () => void;
}

/**
 * Partial failure is normal for a bulk action: say what applied, what did not,
 * and why, instead of collapsing the outcome into one toast.
 */
const BulkResultNotice: Component<BulkResultNoticeProps> = (props) => {
  const applied = () => props.result.applied.length;
  const failed = () => props.result.failed.length;
  return (
    <div class="bulk-result" classList={{ 'bulk-result--failed': failed() > 0 }} role="status">
      <div style="display: flex; align-items: flex-start; gap: var(--gap-sm);">
        <div style="flex: 1;">
          <div class="bulk-result__title">
            {props.action}: applied to {applied()} agent{applied() === 1 ? '' : 's'}
            <Show when={failed() > 0}>, {failed()} did not apply</Show>
          </div>
          <Show when={failed() > 0}>
            <ul class="bulk-result__list">
              <For each={props.result.failed}>
                {(f) => (
                  <li>
                    <strong>{f.agent_name}</strong>: {f.reason}
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" onClick={props.onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default BulkResultNotice;
