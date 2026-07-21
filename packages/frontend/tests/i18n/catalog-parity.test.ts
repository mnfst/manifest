import { describe, expect, it } from 'vitest';
import {
  duplicateCatalogKeys,
  pluralCategories,
  type MessageCatalog,
  type PluralCategory,
  type PluralMessage,
} from '../../src/i18n/catalog-types.js';
import { enComponentsAM } from '../../src/i18n/messages/en/components-a-m.js';
import { enComponentsNZ } from '../../src/i18n/messages/en/components-n-z.js';
import { enFormatters } from '../../src/i18n/messages/en/formatters.js';
import { enI18n } from '../../src/i18n/messages/en/i18n.js';
import en from '../../src/i18n/messages/en/index.js';
import { enPages } from '../../src/i18n/messages/en/pages.js';
import { enProviders } from '../../src/i18n/messages/en/providers.js';
import { enServices } from '../../src/i18n/messages/en/services.js';
import { enShell } from '../../src/i18n/messages/en/shell.js';
import { ruComponentsAM } from '../../src/i18n/messages/ru/components-a-m.js';
import { ruComponentsNZ } from '../../src/i18n/messages/ru/components-n-z.js';
import { ruFormatters } from '../../src/i18n/messages/ru/formatters.js';
import { ruI18n } from '../../src/i18n/messages/ru/i18n.js';
import ru from '../../src/i18n/messages/ru/index.js';
import { ruPages } from '../../src/i18n/messages/ru/pages.js';
import { ruProviders } from '../../src/i18n/messages/ru/providers.js';
import { ruServices } from '../../src/i18n/messages/ru/services.js';
import { ruShell } from '../../src/i18n/messages/ru/shell.js';

const featureSources = {
  en: [
    ['i18n', enI18n],
    ['shell', enShell],
    ['formatters', enFormatters],
    ['services', enServices],
    ['providers', enProviders],
    ['pages', enPages],
    ['components-a-m', enComponentsAM],
    ['components-n-z', enComponentsNZ],
  ],
  ru: [
    ['i18n', ruI18n],
    ['shell', ruShell],
    ['formatters', ruFormatters],
    ['services', ruServices],
    ['providers', ruProviders],
    ['pages', ruPages],
    ['components-a-m', ruComponentsAM],
    ['components-n-z', ruComponentsNZ],
  ],
} as const;

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{([a-zA-Z][\w.]*)\}/g)].map((match) => match[1] ?? '').sort();
}

function pluralForms(message: PluralMessage): PluralCategory[] {
  return Object.keys(message) as PluralCategory[];
}

describe('locale catalog integrity', () => {
  it.each(Object.entries(featureSources))(
    '%s feature modules do not shadow semantic keys',
    (_, sources) => {
      expect(
        duplicateCatalogKeys(
          sources.map(([name, catalog]) => ({ name, catalog: catalog as MessageCatalog })),
        ),
      ).toEqual([]);
    },
  );

  it('reports accidental source collisions deterministically', () => {
    expect(
      duplicateCatalogKeys([
        { name: 'first', catalog: { shared: 'one' } },
        { name: 'second', catalog: { shared: 'two', unique: 'ok' } },
      ]),
    ).toEqual(['shared']);
  });

  it('keeps exactly the same semantic keys and message kinds', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(typeof ru[key], String(key)).toBe(typeof en[key]);
    }
  });

  it.each([
    ['en', en],
    ['ru', ru],
  ] as const)('%s plural messages use valid CLDR forms and cover Intl rules', (locale, catalog) => {
    const required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    for (const [key, message] of Object.entries(catalog)) {
      if (typeof message === 'string') continue;
      const forms = pluralForms(message);
      expect(forms, key).toContain('other');
      expect(
        forms.every((form) => pluralCategories.includes(form)),
        key,
      ).toBe(true);
      for (const category of required) expect(forms, `${key}.${category}`).toContain(category);
    }
  });

  it('does not carry unreachable plural forms in the canonical English catalogue', () => {
    const reachable = new Intl.PluralRules('en').resolvedOptions().pluralCategories.sort();
    for (const [key, message] of Object.entries(en)) {
      if (typeof message === 'string') continue;
      expect(pluralForms(message).sort(), key).toEqual(reachable);
    }
  });

  it('keeps named placeholders aligned for every supplied plural form', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const source = en[key];
      const target = ru[key];

      if (typeof source === 'string' && typeof target === 'string') {
        expect(placeholders(target), String(key)).toEqual(placeholders(source));
        continue;
      }

      if (typeof source !== 'string' && typeof target !== 'string') {
        const sourcePlaceholders = placeholders(source.other);
        const targetPlaceholders = placeholders(target.other);
        expect(targetPlaceholders, `${String(key)}.other`).toEqual(sourcePlaceholders);

        for (const category of pluralForms(source)) {
          expect(placeholders(source[category]!), `en.${String(key)}.${category}`).toEqual(
            sourcePlaceholders,
          );
        }
        for (const category of pluralForms(target)) {
          expect(placeholders(target[category]!), `ru.${String(key)}.${category}`).toEqual(
            targetPlaceholders,
          );
        }
      }
    }
  });

  it('keeps request-first surfaces free of legacy message terminology', () => {
    const requestFirstKeys = [
      'addAgent.description',
      'provider.localHint',
      'message.miscategorizeTitle',
      'pages.workspace.metaDescription',
      'pages.workspace.messages',
      'pages.settings.deleteDescription',
      'pages.globalOverview.recentMessages',
      'pages.globalOverview.messages',
    ] as const;

    for (const key of requestFirstKeys) {
      expect(en[key], `en.${key}`).not.toMatch(/\bmessages?\b/i);
      expect(ru[key], `ru.${key}`).not.toMatch(/сообщен/iu);
    }

    expect(en['message.autofixTriggered']).toContain('provider attempt');
    expect(en['message.autofixTriggered']).not.toContain('request was triggered');
    expect(en['message.fallbackAttempt']).toContain('Provider attempt');
    expect(en['message.fallbackLabel']).toBe('Fallback');
    expect(ru['message.fallbackLabel']).toBe('Резервная модель');
  });
});
