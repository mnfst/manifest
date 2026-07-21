import { For, type Component } from 'solid-js';
import {
  isLocale,
  locale,
  setLocale,
  supportedLocales,
  t,
  type Locale,
  type TextMessageKey,
} from '../i18n/index.js';
import { registerLocaleIntent, updateLocalePreference } from '../services/api/locale.js';

const localeLabelKeys = {
  en: 'language.english',
  ru: 'language.russian',
} as const satisfies Record<Locale, TextMessageKey>;

interface LanguageSelectorProps {
  class?: string;
  syncWorkspace?: boolean;
}

const LanguageSelector: Component<LanguageSelectorProps> = (props) => {
  const handleChange = async (event: Event) => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (isLocale(value)) {
      registerLocaleIntent(value);
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
        <For each={supportedLocales}>
          {(value) => <option value={value}>{t(localeLabelKeys[value])}</option>}
        </For>
      </select>
    </label>
  );
};

export default LanguageSelector;
