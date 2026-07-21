import { Show } from 'solid-js';
import { t } from '../i18n/index.js';

const VersionIndicator = () => {
  const isSelfHosted = import.meta.env.VITE_MANIFEST_SELFHOSTED === 'true';
  const version = __MANIFEST_VERSION__;

  return (
    <Show when={isSelfHosted && version}>
      <div class="version-indicator" aria-label={t('version.aria', { version })}>
        <span>v{version}</span>
      </div>
    </Show>
  );
};

export default VersionIndicator;
