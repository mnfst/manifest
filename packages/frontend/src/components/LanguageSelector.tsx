import type { Component } from 'solid-js';
import { isLocale, locale, setLocale, t } from '../i18n/index.js';
import { updateLocalePreference } from '../services/api/locale.js';

interface LanguageSelectorProps {
  class?: string;
  syncWorkspace?: boolean;
}

const LanguageSelector: Component<LanguageSelectorProps> = (props) => {
  const handleChange = async (event: Event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (isLocale(value)) {
      const activated = await setLocale(value);
      // A newer selector choice may have won while this locale chunk loaded.
      if (props.syncWorkspace !== false && activated === value && locale() === value) {
        await updateLocalePreference(value);
      }
    }
  };

  return (
    <label class={`language-selector ${props.class ?? ''}`.trim()}>
      <span class="sr-only">{t('language.selectLabel')}</span>
      <select
        class="language-selector__select"
        aria-label={t('language.selectLabel')}
        value={locale()}
        onChange={(event) => void handleChange(event)}
      >
        <option value="en">{t('language.english')}</option>
        <option value="ru">{t('language.russian')}</option>
      </select>
    </label>
  );
};

export default LanguageSelector;
