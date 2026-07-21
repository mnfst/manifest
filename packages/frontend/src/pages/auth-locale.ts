import { localeTag } from '../i18n/index.js';

/**
 * Better Auth accepts fetch options as the second argument to client methods.
 * Explicitly forwarding the selected UI locale keeps transactional emails in
 * sync with the language selector, including before a tenant preference exists.
 */
export function authLocaleFetchOptions(): {
  headers: { 'Accept-Language': string; 'X-Manifest-Locale': string };
} {
  const activeLocale = localeTag();
  return {
    headers: {
      'Accept-Language': activeLocale,
      'X-Manifest-Locale': activeLocale,
    },
  };
}
