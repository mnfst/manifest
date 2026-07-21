import type { LocalizedCatalog } from '../../catalog-types.js';
import type { enServices } from '../en/services.js';

export const ruServices = {
  'services.billing.perMonth': '/мес.',
  'services.billing.perYear': '/год',
  'services.keyLabel': 'Ключ {number}',
  'services.routing.free': 'Бесплатно',
  'services.setup.failed': 'Не удалось завершить настройку ({status})',
  'services.api.sessionExpired': 'Сеанс завершён',
  'services.api.unauthorized': 'Требуется авторизация',
  'services.api.error': 'Ошибка API: {status} {statusText}',
  'services.api.requestFailed': 'Не удалось выполнить запрос ({status})',
  'services.playground.noResult': 'Поток завершился без результата',
  'services.playground.bestAnswerFailed': 'Не удалось выбрать лучший ответ',
  'services.playground.starFailed': 'Не удалось изменить отметку',
} as const satisfies LocalizedCatalog<typeof enServices>;
