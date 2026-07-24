import { createResource, createSignal, type Component } from 'solid-js';
import { getRecording, updateRecording } from '../services/api.js';

const SettingsRecordingSection: Component<{ agentName: () => string }> = (props) => {
  const [config, { mutate }] = createResource(() => props.agentName(), getRecording);
  const [saving, setSaving] = createSignal(false);

  const enabled = () => (!config.loading && !config.error ? (config()?.enabled ?? false) : false);
  const busy = () => saving() || config.loading || Boolean(config.error);

  const toggle = async () => {
    if (busy()) return;
    const agentName = props.agentName();
    setSaving(true);
    try {
      const next = await updateRecording(agentName, { enabled: !enabled() });
      if (props.agentName() === agentName) mutate(next);
    } catch {
      // fetchMutate already shows the backend error.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h2 class="settings-section__title">Message recording</h2>
      <div class="settings-card">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Record request messages</span>
            <span class="settings-card__label-desc">
              Store new request conversations, tool definitions, and final responses so you can
              inspect them in the Requests drawer. Existing requests are not affected.
            </span>
          </div>
          <div class="settings-card__control settings-card__control--end">
            <button
              type="button"
              role="switch"
              aria-checked={enabled()}
              aria-label="Message recording"
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

export default SettingsRecordingSection;
