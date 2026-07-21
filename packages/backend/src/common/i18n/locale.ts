export const SUPPORTED_LOCALES = ['en', 'ru'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

const INTL_LOCALES = {
  en: 'en-US',
  ru: 'ru-RU',
} as const satisfies Record<AppLocale, string>;

/** Return whether a value is an exact member of the application locale registry. */
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && SUPPORTED_LOCALE_SET.has(value);
}

/**
 * Normalizes an application locale without ever propagating an unsupported
 * value into Intl or a translation catalogue.
 */
export function normalizeLocale(value: unknown): AppLocale {
  return parseLocale(value) ?? DEFAULT_LOCALE;
}

/** Parse an explicit application locale without turning invalid input into English. */
export function parseLocale(value: unknown): AppLocale | null {
  if (typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/, 1)[0];
  return isAppLocale(base) ? base : null;
}

/**
 * Resolves the first supported locale from an Accept-Language header. Quality
 * weights and wildcards are deliberately ignored after ordering: unsupported
 * entries fall through to English.
 */
export function localeFromAcceptLanguage(header: string | string[] | undefined): AppLocale {
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (!raw) return DEFAULT_LOCALE;

  const candidates = raw
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const qualityParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qualityParam ? Number(qualityParam.trim().slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((candidate) => candidate.tag !== '*' && candidate.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const candidate of candidates) {
    const base = candidate.tag.toLowerCase().split(/[-_]/, 1)[0];
    if (isAppLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export function intlLocale(locale: AppLocale): string {
  return INTL_LOCALES[locale];
}
