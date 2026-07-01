import { createResource, createSignal, Show, type Component } from 'solid-js';
import { getAutofix, updateAutofix } from '../services/api.js';
import { toast } from '../services/toast-store.js';

/**
 * Per-agent Auto-fix control. Self-contained: fetches its own status and
 * persists toggle/budget changes. Shown for every agent (Auto-fix is not gated
 * by the complexity/specificity cohort). Reuses the `routing-switch` styling.
 */
const RoutingAutofixSection: Component<{ agentName: () => string }> = (props) => {
  const [config, { mutate }] = createResource(() => props.agentName(), getAutofix);
  const [saving, setSaving] = createSignal(false);

  const enabled = () => config()?.enabled ?? false;
  const maxAttempts = () => config()?.maxAttempts ?? 3;

  const save = async (patch: { enabled?: boolean; maxAttempts?: number }) => {
    setSaving(true);
    try {
      mutate(await updateAutofix(props.agentName(), patch));
    } catch {
      toast.error('Failed to update Auto-fix');
    } finally {
      setSaving(false);
    }
  };

  const onBudgetChange = (raw: string) => {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 10 || value === maxAttempts()) return;
    void save({ maxAttempts: value });
  };

  return (
    <div class="routing-section">
      <div class="routing-section__header routing-section__header--with-control">
        <div>
          <span class="routing-section__title">Auto-fix</span>
          <span class="routing-section__subtitle">
            Repairs failing requests before they reach the model. When a request fails with a
            fixable error, Manifest patches it and retries automatically.
          </span>
        </div>
        <div class="routing-section__controls">
          <button
            type="button"
            class="routing-switch"
            classList={{ 'routing-switch--on': enabled() }}
            disabled={saving() || config.loading}
            onClick={() => void save({ enabled: !enabled() })}
          >
            <span class="routing-switch__label">Auto-fix</span>
            <span class="routing-switch__track">
              <span class="routing-switch__thumb" />
            </span>
          </button>
        </div>
      </div>
      <Show when={enabled()}>
        <label
          class="routing-autofix__budget"
          style="display: flex; align-items: center; gap: 8px; margin-top: 12px;"
        >
          <span class="routing-section__subtitle">Max retries per request</span>
          <input
            type="number"
            min="1"
            max="10"
            value={maxAttempts()}
            disabled={saving()}
            onChange={(e) => onBudgetChange(e.currentTarget.value)}
            style="width: 64px;"
          />
        </label>
      </Show>
    </div>
  );
};

export default RoutingAutofixSection;
