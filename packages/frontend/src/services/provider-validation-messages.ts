import { t, type TextMessageKey } from '../i18n/index.js';
import type { CredentialValidationError, CredentialValidationErrorCode } from './provider-utils.js';

const CREDENTIAL_VALIDATION_MESSAGE_KEYS = {
  apiKeyRequired: 'provider.validation.apiKeyRequired',
  apiKeyPrefix: 'provider.validation.apiKeyPrefix',
  apiKeyTooShort: 'provider.validation.apiKeyTooShort',
  subscriptionTokenRequired: 'provider.validation.subscriptionTokenRequired',
  subscriptionTokenPrefix: 'provider.validation.subscriptionTokenPrefix',
  apiKeyInSubscriptionMode: 'provider.validation.apiKeyInSubscriptionMode',
  subscriptionTokenTooShort: 'provider.validation.subscriptionTokenTooShort',
} as const satisfies Record<CredentialValidationErrorCode, TextMessageKey>;

/** Translate a local validation error at the UI boundary. Backend errors stay untouched. */
export function credentialValidationMessage(error: CredentialValidationError): string {
  switch (error.code) {
    case 'apiKeyRequired':
      return t(CREDENTIAL_VALIDATION_MESSAGE_KEYS.apiKeyRequired);
    case 'apiKeyPrefix':
      return t(CREDENTIAL_VALIDATION_MESSAGE_KEYS.apiKeyPrefix, error.params);
    case 'apiKeyTooShort':
      return t(CREDENTIAL_VALIDATION_MESSAGE_KEYS.apiKeyTooShort, error.params);
    case 'subscriptionTokenRequired':
      return t(CREDENTIAL_VALIDATION_MESSAGE_KEYS.subscriptionTokenRequired);
    case 'subscriptionTokenPrefix':
      return t(CREDENTIAL_VALIDATION_MESSAGE_KEYS.subscriptionTokenPrefix, error.params);
    case 'apiKeyInSubscriptionMode':
      return t(CREDENTIAL_VALIDATION_MESSAGE_KEYS.apiKeyInSubscriptionMode);
    case 'subscriptionTokenTooShort':
      return t(CREDENTIAL_VALIDATION_MESSAGE_KEYS.subscriptionTokenTooShort, error.params);
  }
}
