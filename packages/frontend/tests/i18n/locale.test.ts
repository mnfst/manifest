import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCALE_STORAGE_KEY,
  initializeI18n,
  locale,
  localeTag,
  normalizeLocale,
  resolveLocale,
  setLocale,
  supportedLocales,
} from '../../src/i18n/index.js';
import { ensureLocalStorage } from './storage.js';

function storageWith(value: string | null) {
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
  };
}

function declaredLocales(relativePath: string): string[] {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const declaration = source.match(/(?:var|const) supportedLocales = \[([^\]]*)\]/);
  expect(declaration, `${relativePath} must declare supportedLocales`).not.toBeNull();
  return [...(declaration?.[1] ?? '').matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]!);
}

describe('locale resolution', () => {
  beforeEach(async () => {
    ensureLocalStorage().clear();
    await initializeI18n({ storage: null, languages: ['en-US'] });
  });

  it('normalizes supported regional and underscore locale tags', () => {
    expect(normalizeLocale('ru-RU')).toBe('ru');
    expect(normalizeLocale('EN_us')).toBe('en');
    expect(normalizeLocale('de-DE')).toBeNull();
  });

  it('gives a stored valid preference priority over browser languages', () => {
    expect(resolveLocale({ storage: storageWith('en'), languages: ['ru-RU'] })).toBe('en');
  });

  it('ignores invalid stored values and checks browser languages in order', () => {
    expect(
      resolveLocale({ storage: storageWith('invalid'), languages: ['de-DE', 'ru-RU', 'en-US'] }),
    ).toBe('ru');
  });

  it('falls back to English for unsupported or unavailable languages', () => {
    expect(resolveLocale({ storage: null, languages: ['de-DE'] })).toBe('en');
    expect(resolveLocale({ storage: null, languages: null })).toBe('en');
  });

  it('treats an unavailable localStorage as a non-fatal condition', () => {
    const brokenStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('Access denied');
      }),
      setItem: vi.fn(),
    };

    expect(resolveLocale({ storage: brokenStorage, languages: ['ru'] })).toBe('ru');
  });

  it('keeps prepaint and bundle locale registries aligned with the runtime', () => {
    expect(declaredLocales('../../public/theme-init.js')).toEqual([...supportedLocales]);
    expect(declaredLocales('../../scripts/check-i18n-bundle.mjs')).toEqual([...supportedLocales]);
  });
});

describe('active locale', () => {
  beforeEach(async () => {
    ensureLocalStorage().clear();
    await initializeI18n({ storage: null, languages: ['en-US'] });
  });

  it('initializes before render and updates the document language', async () => {
    await expect(initializeI18n({ storage: null, languages: ['ru-RU'] })).resolves.toBe('ru');
    expect(locale()).toBe('ru');
    expect(localeTag()).toBe('ru-RU');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('persists an explicit choice and updates html[lang]', async () => {
    await setLocale('ru');

    expect(locale()).toBe('ru');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('keeps the in-memory locale when persistence is blocked', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded');
    });

    await expect(setLocale('ru')).resolves.toBe('ru');
    expect(locale()).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');

    setItem.mockRestore();
  });
});
