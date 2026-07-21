import { createResource, createSignal, type Component } from 'solid-js';
import { getAutofixCohort, setDevAutofixCohort } from '../services/api/autofix.js';
import { t } from '../i18n/index.js';

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
      aria-label={t(enabled() ? 'devAutofix.revoke' : 'devAutofix.grant')}
      aria-pressed={enabled()}
      disabled={saving() || unavailable()}
      title={t('devAutofix.title')}
      onClick={toggle}
    >
      <span>{t('devAutofix.dev')}</span>
      <span class="header__dev-autofix-divider" aria-hidden="true" />
      <span class="header__dev-autofix-dot" aria-hidden="true" />
      <span>
        {t('devAutofix.version', {
          status: t(
            saving() || cohort.loading
              ? 'devAutofix.status.loading'
              : enabled()
                ? 'devAutofix.status.available'
                : 'devAutofix.status.unavailable',
          ),
        })}
      </span>
    </button>
  );
};

export default DevAutofixToggle;
