import {
  DEFAULT_LOCALE,
  intlLocale,
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
});
