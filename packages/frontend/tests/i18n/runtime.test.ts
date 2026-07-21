import { createMemo, createRoot } from 'solid-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeI18n,
  pluralCategory,
  setLocale,
  selectPluralForm,
  t,
  tp,
  type TextMessageKey,
} from '../../src/i18n/index.js';
import { ensureLocalStorage } from './storage.js';

describe('translations', () => {
  beforeEach(async () => {
    ensureLocalStorage().clear();
    await initializeI18n({ storage: null, languages: ['en-US'] });
  });

  it('uses the canonical English catalog by default', () => {
    expect(t('i18n.language')).toBe('Language');
    expect(t('i18n.welcome', { name: 'Ada' })).toBe('Welcome, Ada');
    expect(tp('i18n.itemCount', 2)).toBe('2 items');
  });

  it('interpolates named values without interpreting them as markup', () => {
    expect(t('i18n.welcome', { name: '<script>alert(1)</script>' })).toBe(
      'Welcome, <script>alert(1)</script>',
    );
  });

  it('reacts to locale changes', async () => {
    let dispose!: () => void;
    const language = createRoot((rootDispose) => {
      dispose = rootDispose;
      return createMemo(() => t('i18n.language'));
    });

    expect(language()).toBe('Language');
    await setLocale('ru');
    expect(language()).toBe('Язык');

    dispose();
  });

  it('returns the semantic key instead of crashing for an unknown runtime key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unknownKey = 'missing.runtime.key' as TextMessageKey;

    expect(t(unknownKey)).toBe('missing.runtime.key');
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });
});

describe('Russian plural selection', () => {
  beforeEach(async () => {
    ensureLocalStorage().clear();
    await initializeI18n({ storage: null, languages: ['ru-RU'] });
  });

  it.each([
    [0, 'many', '0 элементов'],
    [1, 'one', '1 элемент'],
    [2, 'few', '2 элемента'],
    [5, 'many', '5 элементов'],
    [11, 'many', '11 элементов'],
    [21, 'one', '21 элемент'],
    [22, 'few', '22 элемента'],
    [25, 'many', '25 элементов'],
    [101, 'one', '101 элемент'],
    [111, 'many', '111 элементов'],
  ] as const)('selects %s as %s', (count, category, expected) => {
    expect(pluralCategory(count)).toBe(category);
    expect(tp('i18n.itemCount', count)).toBe(expected);
  });

  it('uses the required other form for fractions', () => {
    expect(pluralCategory(1.5)).toBe('other');
    expect(tp('i18n.itemCount', 1.5)).toBe('1,5 элемента');
  });

  it('formats count placeholders with the active locale', () => {
    expect(tp('i18n.itemCount', 12_345)).toBe('12 345 элементов');
  });
});

describe('dynamic catalogue loading', () => {
  const englishModule = {
    default: {
      'i18n.language': 'English from loader',
      'i18n.welcome': 'Welcome, {name}',
      'i18n.itemCount': { one: '{count} item', other: '{count} items' },
    },
  } as const;
  const russianModule = {
    default: {
      'i18n.language': 'Русский из загрузчика',
    },
  } as const;

  it('loads the resolved catalogue before activating it', async () => {
    const en = vi.fn(async () => englishModule);
    const ru = vi.fn(async () => russianModule);

    await expect(
      initializeI18n({ storage: null, languages: ['ru-RU'] }, { en, ru } as never),
    ).resolves.toBe('ru');

    expect(en).toHaveBeenCalledOnce();
    expect(ru).toHaveBeenCalledOnce();
    expect(t('i18n.language')).toBe('Русский из загрузчика');
    // A missing localized key falls back per key to the dynamically loaded English catalogue.
    expect(t('i18n.welcome', { name: 'Ada' })).toBe('Welcome, Ada');
  });

  it('falls back to English when a selected locale chunk fails', async () => {
    const en = vi.fn(async () => englishModule);
    const ru = vi.fn(async () => {
      throw new Error('chunk unavailable');
    });

    await expect(
      initializeI18n({ storage: null, languages: ['ru-RU'] }, { en, ru } as never),
    ).resolves.toBe('en');
    expect(t('i18n.language')).toBe('English from loader');
  });

  it('keeps the last choice when catalogue requests resolve out of order', async () => {
    let resolveEnglish!: (module: typeof englishModule) => void;
    let resolveRussian!: (module: typeof russianModule) => void;
    const english = new Promise<typeof englishModule>((resolve) => (resolveEnglish = resolve));
    const russian = new Promise<typeof russianModule>((resolve) => (resolveRussian = resolve));
    const loaders = {
      en: vi.fn(() => english),
      ru: vi.fn(() => russian),
    } as never;

    const russianChoice = setLocale('ru', loaders);
    const englishChoice = setLocale('en', loaders);
    resolveEnglish(englishModule);
    await englishChoice;
    expect(t('i18n.language')).toBe('English from loader');

    resolveRussian(russianModule);
    await russianChoice;
    expect(t('i18n.language')).toBe('English from loader');
  });
});

describe('CLDR plural form selection', () => {
  it('supports synthetic zero/two categories and falls back to other', () => {
    const message = {
      zero: 'nothing',
      two: 'a pair',
      other: 'fallback',
    } as const;

    expect(selectPluralForm(message, 'zero')).toBe('nothing');
    expect(selectPluralForm(message, 'two')).toBe('a pair');
    expect(selectPluralForm(message, 'many')).toBe('fallback');
  });
});
