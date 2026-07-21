import type { MessageCatalog } from '../../catalog-types.js';

export const enI18n = {
  'i18n.language': 'Language',
  'i18n.language.en': 'English',
  'i18n.language.ru': 'Russian',
  'i18n.itemCount': {
    one: '{count} item',
    few: '{count} items',
    many: '{count} items',
    other: '{count} items',
  },
  'i18n.welcome': 'Welcome, {name}',
} as const satisfies MessageCatalog;
