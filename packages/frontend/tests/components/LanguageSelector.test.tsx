import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LanguageSelector from '../../src/components/LanguageSelector.jsx';
import { initializeI18n, locale, LOCALE_STORAGE_KEY } from '../../src/i18n/index.js';

describe('LanguageSelector', () => {
  beforeEach(async () => {
    localStorage.clear();
    await initializeI18n({ storage: null, languages: ['en-US'] });
    vi.restoreAllMocks();
  });

  it('offers both supported languages using recognizable native names', () => {
    render(() => <LanguageSelector />);

    expect(screen.getByRole('option', { name: 'English' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Russian' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Interface language' })).toBeDefined();
  });

  it('switches reactively, updates html[lang], persists locally, and syncs the workspace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ locale: 'ru' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(() => <LanguageSelector />);

    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ru' } });

    await waitFor(() => expect(locale()).toBe('ru'));
    expect(document.documentElement.lang).toBe('ru');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ru');
    expect(screen.getByRole('combobox', { name: 'Язык интерфейса' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Русский' })).toBeDefined();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/settings/locale',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ locale: 'ru' }) }),
      ),
    );
  });

  it('keeps the local switch when workspace persistence is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    render(() => <LanguageSelector />);

    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ru' } });

    await waitFor(() => expect(locale()).toBe('ru'));
    expect(document.documentElement.lang).toBe('ru');
  });

  it('does not write an authenticated workspace preference on guest surfaces', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(() => <LanguageSelector syncWorkspace={false} />);

    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ru' } });

    await waitFor(() => expect(locale()).toBe('ru'));
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ru');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
