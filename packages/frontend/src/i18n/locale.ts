import { createSignal } from 'solid-js';

export const supportedLocales = ['en', 'ru'] as const;
export type Locale = (typeof supportedLocales)[number];

export const LOCALE_STORAGE_KEY = 'manifest.locale';

const localeTags: Readonly<Record<Locale, string>> = {
  en: 'en-US',
  ru: 'ru-RU',
};

interface LocaleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LocaleEnvironment {
  storage?: LocaleStorage | null;
  languages?: readonly string[] | null;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return supportedLocales.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;

  const language = value.trim().toLowerCase().split(/[-_]/, 1)[0];
  return isLocale(language) ? language : null;
}

function readStoredLocale(storage: LocaleStorage | null | undefined): Locale | null {
  if (!storage) return null;

  try {
    const stored = storage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

function browserStorage(): LocaleStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}

/** Resolve once in a deterministic order: an explicit choice wins over the browser. */
export function resolveLocale(environment: LocaleEnvironment = {}): Locale {
  const storage = environment.storage === undefined ? browserStorage() : environment.storage;
  const stored = readStoredLocale(storage);
  if (stored) return stored;

  const languages =
    environment.languages === undefined ? browserLanguages() : environment.languages;
  for (const language of languages ?? []) {
    const normalized = normalizeLocale(language);
    if (normalized) return normalized;
  }

  return 'en';
}

const [activeLocale, setActiveLocale] = createSignal<Locale>('en');

export const locale = activeLocale;

export function localeTag(value: Locale = activeLocale()): string {
  return localeTags[value];
}

function updateDocumentLanguage(value: Locale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value;
  }
}

function persistLocale(value: Locale): void {
  const storage = browserStorage();
  if (!storage) return;

  try {
    storage.setItem(LOCALE_STORAGE_KEY, value);
  } catch {
    // Storage can be blocked in private mode. The in-memory locale still works.
  }
}

/** Commit a locale only after its catalogue has been loaded by the runtime. */
export function activateLocale(value: Locale, persist: boolean): void {
  setActiveLocale(value);
  updateDocumentLanguage(value);
  if (persist) persistLocale(value);
}
