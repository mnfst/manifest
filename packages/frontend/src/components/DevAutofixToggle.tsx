import { createResource, createSignal, type Component } from 'solid-js';
import { getAutofixCohort, setDevAutofixCohort } from '../services/api/autofix.js';

const DevAutofixToggle: Component = () => {
  const [cohort, { mutate }] = createResource(getAutofixCohort);
  const [saving, setSaving] = createSignal(false);
  const enabled = () => cohort()?.eligible === true;
  const unavailable = () => cohort.loading || cohort.error != null;

  const toggle = async () => {
    if (saving() || unavailable()) return;

    setSaving(true);
    try {
      const updated = await setDevAutofixCohort(!enabled());
      mutate(updated);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      class={`header__mode-badge header__mode-badge--dev header__dev-autofix${
        enabled() ? ' header__dev-autofix--active' : ''
      }`}
      aria-label={`${enabled() ? 'Revoke' : 'Grant'} the Dr version for this tenant`}
      aria-pressed={enabled()}
      disabled={saving() || unavailable()}
      title="Toggle the current tenant's Dr version access (development only)"
      onClick={toggle}
    >
      <span>Dev</span>
      <span class="header__dev-autofix-divider" aria-hidden="true" />
      <span class="header__dev-autofix-dot" aria-hidden="true" />
      <span>
        Dr version {saving() || cohort.loading ? '…' : enabled() ? 'available' : 'unavailable'}
      </span>
    </button>
  );
};

export default DevAutofixToggle;
