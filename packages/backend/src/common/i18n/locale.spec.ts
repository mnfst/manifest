import {
  DEFAULT_LOCALE,
  intlLocale,
  isAppLocale,
  localeFromAcceptLanguage,
  normalizeLocale,
  parseLocale,
} from './locale';

describe('locale helpers', () => {
  it('normalizes supported regional tags and falls back safely', () => {
    expect(normalizeLocale('ru-RU')).toBe('ru');
    expect(normalizeLocale('EN_us')).toBe('en');
    expect(normalizeLocale('de')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
  });

  it('parses explicit locales without treating invalid values as English', () => {
    expect(parseLocale('RU-ru')).toBe('ru');
    expect(parseLocale('de-DE')).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });

  it('recognizes only exact members of the locale registry', () => {
    expect(isAppLocale('en')).toBe(true);
    expect(isAppLocale('ru')).toBe(true);
    expect(isAppLocale('ru-RU')).toBe(false);
    expect(isAppLocale('de')).toBe(false);
    expect(isAppLocale(123)).toBe(false);
  });

  it('respects Accept-Language quality ordering', () => {
    expect(localeFromAcceptLanguage('en-US;q=0.6, ru-RU;q=0.9')).toBe('ru');
    expect(localeFromAcceptLanguage('de-DE, ru;q=0.8')).toBe('ru');
    expect(localeFromAcceptLanguage('ru;q=0, en;q=0.5')).toBe('en');
    expect(localeFromAcceptLanguage('de-DE, *;q=0.5')).toBe('en');
  });

  it('returns stable Intl locale tags', () => {
    expect(intlLocale('en')).toBe('en-US');
    expect(intlLocale('ru')).toBe('ru-RU');
  });

  it('keeps locale catalogues exhaustive when the registry grows', () => {
    type HypotheticalLocale = 'en' | 'ru' | 'de';

    // @ts-expect-error A new registry member must make every incomplete catalogue fail to compile.
    const incompleteCatalog: Record<HypotheticalLocale, string> = { en: 'English', ru: 'Русский' };

    expect(incompleteCatalog.en).toBe('English');
  });
});
