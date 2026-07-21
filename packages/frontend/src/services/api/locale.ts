import { isLocale, locale, LOCALE_STORAGE_KEY, setLocale, type Locale } from '../../i18n/index.js';
import { BASE_URL } from './core.js';

interface LocalePreferenceResponse {
  locale: Locale | null;
}

async function localeRequest(options?: RequestInit): Promise<LocalePreferenceResponse | null> {
  try {
    const response = await fetch(`${BASE_URL}/settings/locale`, {
      credentials: 'include',
      ...options,
    });
    if (!response.ok) return null;
    return (await response.json()) as LocalePreferenceResponse;
  } catch {
    // Locale persistence must never block navigation or a local language switch.
    return null;
  }
}

// Keep writes in user-selection order. Without this queue two fast switches can
// complete out of order and leave the workspace on the older language.
let localeWriteQueue: Promise<void> = Promise.resolve();

export function updateLocalePreference(value: Locale): Promise<void> {
  const write = localeWriteQueue.then(async () => {
    await localeRequest({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: value }),
    });
  });
  localeWriteQueue = write.catch(() => undefined);
  return write;
}

function explicitLocalPreference(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Reconcile the authenticated workspace preference without delaying first paint. */
export async function syncLocalePreference(): Promise<void> {
  const localPreference = explicitLocalPreference();
  if (localPreference) {
    await updateLocalePreference(localPreference);
    return;
  }

  const stored = await localeRequest();
  // A user may change the selector while the initial GET is in flight. Never
  // let that stale response overwrite the newer explicit browser choice.
  const preferenceChosenWhileLoading = explicitLocalPreference();
  if (preferenceChosenWhileLoading) {
    await updateLocalePreference(preferenceChosenWhileLoading);
    return;
  }
  if (stored?.locale && isLocale(stored.locale)) {
    await setLocale(stored.locale);
    return;
  }

  await updateLocalePreference(locale());
}
