import type { LocalizedCatalog } from '../../catalog-types.js';
import { enI18n } from '../en/i18n.js';

export const ruI18n = {
  'i18n.language': 'Язык',
  'i18n.language.en': 'Английский',
  'i18n.language.ru': 'Русский',
  'i18n.itemCount': {
    one: '{count} элемент',
    few: '{count} элемента',
    many: '{count} элементов',
    other: '{count} элемента',
  },
  'i18n.welcome': 'Добро пожаловать, {name}',
} as const satisfies LocalizedCatalog<typeof enI18n>;
