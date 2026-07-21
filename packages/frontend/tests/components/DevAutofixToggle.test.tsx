import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAutofixCohort = vi.fn();
const setDevAutofixCohort = vi.fn();
const reload = vi.fn();

vi.mock('../../src/services/api/autofix.js', () => ({
  getAutofixCohort: (...args: unknown[]) => getAutofixCohort(...args),
  setDevAutofixCohort: (...args: unknown[]) => setDevAutofixCohort(...args),
}));

import DevAutofixToggle from '../../src/components/DevAutofixToggle';
import { setLocale } from '../../src/i18n/index.js';

beforeEach(() => {
  getAutofixCohort.mockReset();
  setDevAutofixCohort.mockReset();
  reload.mockReset();
  vi.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    reload,
  });
});

describe('DevAutofixToggle', () => {
  it('grants the Dr version and reloads the dashboard', async () => {
    getAutofixCohort.mockResolvedValue({ eligible: false });
    setDevAutofixCohort.mockResolvedValue({ eligible: true });
    render(() => <DevAutofixToggle />);

    const button = await screen.findByRole('button', {
      name: 'Grant the Dr version for this tenant',
    });
    expect(button.getAttribute('aria-pressed')).toBe('false');

    await fireEvent.click(button);

    expect(setDevAutofixCohort).toHaveBeenCalledWith(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('revokes the Dr version and reloads the dashboard', async () => {
    getAutofixCohort.mockResolvedValue({ eligible: true });
    setDevAutofixCohort.mockResolvedValue({ eligible: false });
    render(() => <DevAutofixToggle />);

    const button = await screen.findByRole('button', {
      name: 'Revoke the Dr version for this tenant',
    });
    expect(button.getAttribute('aria-pressed')).toBe('true');

    await fireEvent.click(button);

    expect(setDevAutofixCohort).toHaveBeenCalledWith(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('stays disabled while cohort state is loading', () => {
    getAutofixCohort.mockReturnValue(new Promise(() => {}));
    render(() => <DevAutofixToggle />);

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Dr version …')).toBeDefined();
  });

  it('updates the mounted control and accessible name on a live locale switch', async () => {
    getAutofixCohort.mockResolvedValue({ eligible: true });
    render(() => <DevAutofixToggle />);
    await screen.findByRole('button', { name: 'Revoke the Dr version for this tenant' });

    await setLocale('ru');
    try {
      const button = await screen.findByRole('button', {
        name: 'Отозвать у этого рабочего пространства доступ к версии Dr',
      });
      expect(button.getAttribute('title')).toBe(
        'Переключить доступ текущего рабочего пространства к версии Dr (только для разработки)',
      );
      expect(screen.getByText('Версия Dr: доступна')).toBeDefined();
    } finally {
      await setLocale('en');
    }
  });
});
