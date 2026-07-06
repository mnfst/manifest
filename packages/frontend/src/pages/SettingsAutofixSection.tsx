import { createResource, createSignal, type Component } from 'solid-js';
import { getAutofix, updateAutofix } from '../services/api.js';
import { toast } from '../services/toast-store.js';

/**
 * Per-agent Auto-fix toggle on the Settings page. Fetches its own status and
 * persists the on/off choice. The effective value shown here already reflects
 * the deployment-mode default resolved by the backend (ON in cloud, OFF in
 * self-hosted) when the agent has made no explicit choice.
 */
const SettingsAutofixSection: Component<{ agentName: () => string }> = (props) => {
  const [config, { mutate }] = createResource(() => props.agentName(), getAutofix);
  const [saving, setSaving] = createSignal(false);

  const enabled = () => config()?.enabled ?? false;
  const busy = () => saving() || config.loading;

  const toggle = async () => {
    if (busy()) return;
    setSaving(true);
    try {
      mutate(await updateAutofix(props.agentName(), { enabled: !enabled() }));
    } catch {
      toast.error('Failed to update Auto-fix');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h2 class="settings-section__title">Auto-fix</h2>
      <div class="settings-card">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Auto-fix failing requests</span>
            <span class="settings-card__label-desc">
              When a request fails with a fixable error, Manifest repairs it and retries once before
              falling back, so a bad request gets fixed instead of just failing over.
            </span>
          </div>
          <div class="settings-card__control settings-card__control--end">
            <button
              type="button"
              role="switch"
              aria-checked={enabled()}
              aria-label="Auto-fix"
              class="settings-switch"
              classList={{ 'settings-switch--on': enabled() }}
              disabled={busy()}
              onClick={() => void toggle()}
            >
              <span class="settings-switch__track">
                <span class="settings-switch__thumb" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsAutofixSection;
