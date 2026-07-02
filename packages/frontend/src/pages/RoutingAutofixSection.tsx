import { createResource, createSignal, type Component } from 'solid-js';
import { getAutofix, updateAutofix } from '../services/api.js';
import { toast } from '../services/toast-store.js';

/**
 * Per-agent Auto-fix control. Self-contained: fetches its own status and
 * persists the on/off toggle. Shown for every agent (Auto-fix is not gated by
 * the complexity/specificity cohort). Reuses the `routing-switch` styling.
 */
const RoutingAutofixSection: Component<{ agentName: () => string }> = (props) => {
  const [config, { mutate }] = createResource(() => props.agentName(), getAutofix);
  const [saving, setSaving] = createSignal(false);

  const enabled = () => config()?.enabled ?? false;

  const save = async (patch: { enabled?: boolean }) => {
    setSaving(true);
    try {
      mutate(await updateAutofix(props.agentName(), patch));
    } catch {
      toast.error('Failed to update Auto-fix');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="routing-section">
      <div class="routing-section__header routing-section__header--with-control">
        <div>
          <span class="routing-section__title">Auto-fix</span>
          <span class="routing-section__subtitle">
            Repairs failing requests before they reach the model. When a request fails with a
            fixable error, Manifest patches it and retries once automatically.
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
    </div>
  );
};

export default RoutingAutofixSection;
