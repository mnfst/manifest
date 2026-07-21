import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../src/i18n/index.js';
import { authLocaleFetchOptions } from '../../src/pages/auth-locale.js';

describe('authLocaleFetchOptions', () => {
  afterEach(async () => setLocale('en'));

  it('uses the active UI locale instead of the browser default', async () => {
    await setLocale('ru');

    expect(authLocaleFetchOptions()).toEqual({
      headers: { 'Accept-Language': 'ru-RU', 'X-Manifest-Locale': 'ru-RU' },
    });
  });
});
