import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n, locale, LOCALE_STORAGE_KEY, setLocale } from '../../src/i18n/index.js';
import {
  registerLocaleIntent,
  syncLocalePreference,
  updateLocalePreference,
} from '../../src/services/api/locale.js';

describe('workspace locale synchronization', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initializeI18n({ storage: null, languages: ['en-US'] });
    vi.restoreAllMocks();
  });

  it('pushes an explicit device preference to the workspace', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ru');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ locale: 'ru' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await syncLocalePreference();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/settings/locale',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ locale: 'ru' }) }),
    );
  });

  it('uses a persisted workspace preference on a new device', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ locale: 'ru' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await syncLocalePreference();

    expect(locale()).toBe('ru');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ru');
  });

  it('does not overwrite a language selected while the workspace request is pending', async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveRequest = resolve)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ locale: 'en' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const syncing = syncLocalePreference();
    await setLocale('en');
    resolveRequest(
      new Response(JSON.stringify({ locale: 'ru' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await syncing;

    expect(locale()).toBe('en');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/settings/locale',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ locale: 'en' }) }),
    );
  });

  it('persists the browser-resolved locale when the workspace has no preference', async () => {
    await initializeI18n({ storage: null, languages: ['ru-RU'] });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ locale: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ locale: 'ru' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await syncLocalePreference();

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/settings/locale',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ locale: 'ru' }) }),
    );
  });

  it('keeps a local switch working when the backend is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    await expect(updateLocalePreference('ru')).resolves.toBeUndefined();
  });

  it('serializes rapid writes so an older response cannot win on the server', async () => {
    let resolveFirst!: (response: Response) => void;
    let storedLocale = 'en';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      const requested = JSON.parse(String(options?.body)).locale as 'en' | 'ru';
      if (fetchMock.mock.calls.length === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = (response) => {
            storedLocale = requested;
            resolve(response);
          };
        });
      }
      storedLocale = requested;
      return Promise.resolve(
        new Response(JSON.stringify({ locale: requested }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const first = updateLocalePreference('ru');
    const second = updateLocalePreference('en');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    resolveFirst(
      new Response(JSON.stringify({ locale: 'ru' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([, options]) => options?.body)).toEqual([
      JSON.stringify({ locale: 'ru' }),
      JSON.stringify({ locale: 'en' }),
    ]);
    expect(storedLocale).toBe('en');
  });

  it('does not let a stale GET cancel a selector intent while its chunk is loading', async () => {
    let resolveRequest!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveRequest = resolve)),
    );
    const syncing = syncLocalePreference();

    let resolveRussian!: (module: typeof import('../../src/i18n/messages/ru/index.js')) => void;
    const russianChunk = new Promise<typeof import('../../src/i18n/messages/ru/index.js')>(
      (resolve) => (resolveRussian = resolve),
    );
    registerLocaleIntent('ru');
    const switching = setLocale('ru', {
      en: () => import('../../src/i18n/messages/en/index.js'),
      ru: () => russianChunk,
    });

    resolveRequest(
      new Response(JSON.stringify({ locale: 'en' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await syncing;
    resolveRussian(await import('../../src/i18n/messages/ru/index.js'));
    await switching;

    expect(locale()).toBe('ru');
  });
});
