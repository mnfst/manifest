import type { MessageCatalog } from '../../catalog-types.js';

export const enServices = {
  'services.billing.perMonth': '/mo',
  'services.billing.perYear': '/year',
  'services.keyLabel': 'Key {number}',
  'services.routing.free': 'Free',
  'services.setup.failed': 'Setup failed ({status})',
  'services.api.sessionExpired': 'Session expired',
  'services.api.unauthorized': 'Unauthorized',
  'services.api.error': 'API error: {status} {statusText}',
  'services.api.requestFailed': 'Request failed ({status})',
  'services.playground.noResult': 'Stream ended without a result',
  'services.playground.bestAnswerFailed': 'Failed to set best answer',
  'services.playground.starFailed': 'Failed to toggle star',
} as const satisfies MessageCatalog;
