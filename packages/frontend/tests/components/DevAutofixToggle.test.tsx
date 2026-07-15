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
  it('activates Auto-fix and reloads the dashboard', async () => {
    getAutofixCohort.mockResolvedValue({ eligible: false });
    setDevAutofixCohort.mockResolvedValue({ eligible: true });
    render(() => <DevAutofixToggle />);

    const button = await screen.findByRole('button', { name: 'Activate Auto-fix for this tenant' });
    expect(button.getAttribute('aria-pressed')).toBe('false');

    await fireEvent.click(button);

    expect(setDevAutofixCohort).toHaveBeenCalledWith(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('deactivates Auto-fix and reloads the dashboard', async () => {
    getAutofixCohort.mockResolvedValue({ eligible: true });
    setDevAutofixCohort.mockResolvedValue({ eligible: false });
    render(() => <DevAutofixToggle />);

    const button = await screen.findByRole('button', {
      name: 'Deactivate Auto-fix for this tenant',
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
    expect(screen.getByText('Auto-fix …')).toBeDefined();
  });
});
