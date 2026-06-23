import { createResource, createSignal, type Component } from 'solid-js';
import { disableHealing, enableHealing, getHealingStatus } from '../services/api/routing.js';
import { toast } from '../services/toast-store.js';

/**
 * Per-agent request-healing activation. On = recoverable provider errors for
 * this agent are auto-repaired and retried (mirrors provider activation).
 */
const HealingToggle: Component<{ agentName: () => string }> = (props) => {
  const [status, { mutate }] = createResource(props.agentName, getHealingStatus);
  const [busy, setBusy] = createSignal(false);
  const enabled = () => status()?.enabled ?? false;

  const toggle = async () => {
    if (busy()) return;
    setBusy(true);
    const next = !enabled();
    try {
      if (next) await enableHealing(props.agentName());
      else await disableHealing(props.agentName());
      mutate({ enabled: next });
    } catch {
      toast.error('Failed to update request healing');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="healing-toggle">
      <div class="healing-toggle__copy">
        <h3>Request healing</h3>
        <p>Automatically repair recoverable provider errors and retry the request.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled()}
        class="healing-toggle__switch"
        disabled={busy() || status.loading}
        onClick={toggle}
      >
        {enabled() ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
};

export default HealingToggle;
