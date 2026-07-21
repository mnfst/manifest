import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import PlanPicker from '../../src/components/PlanPicker';
import { FREE_REQUEST_LIMIT_LABEL } from '../../src/services/billing-display';
import { setLocale } from '../../src/i18n/index.js';

const monthlyUsd = { amount: 20, currency: 'USD', interval: 'month' } as const;

describe('PlanPicker', () => {
  beforeEach(async () => setLocale('en'));

  it('renders the Pro plan expanded by default and submits it', () => {
    const onSelect = vi.fn();
    const { container } = render(() => <PlanPicker proPrice={monthlyUsd} onSelect={onSelect} />);

    expect(screen.getByText('Popular')).toBeDefined();
    expect(screen.getByText('$20')).toBeDefined();
    expect(screen.getAllByText('/month').length).toBeGreaterThan(0);
    expect(screen.getByText('Unlimited routed requests')).toBeDefined();

    fireEvent.click(container.querySelector('.plan-picker__cta')!);

    expect(onSelect).toHaveBeenCalledWith('pro');
  });

  it('expands the Free plan with usage and submits it', () => {
    const onSelect = vi.fn();
    const { container } = render(() => (
      <PlanPicker proPrice={monthlyUsd} usedRequests={1234} onSelect={onSelect} />
    ));

    const cards = container.querySelectorAll<HTMLButtonElement>('.plan-picker__card');
    fireEvent.click(cards[0]);

    expect(screen.getByText('1,234 used this month')).toBeDefined();
    expect(screen.getByText(`${FREE_REQUEST_LIMIT_LABEL} routed requests / month`)).toBeDefined();
    expect(screen.getByText('Community support via Discord')).toBeDefined();

    fireEvent.click(container.querySelector('.plan-picker__cta')!);

    expect(onSelect).toHaveBeenCalledWith('free');
  });

  it('collapses the selected plan when it is clicked again', () => {
    const { container } = render(() => (
      <PlanPicker proPrice={monthlyUsd} onSelect={vi.fn()} />
    ));
    const proCard = container.querySelectorAll<HTMLButtonElement>('.plan-picker__card')[1];

    fireEvent.click(proCard);

    expect(container.querySelector('.plan-picker__cta')).toBeNull();
  });

  it('renders enterprise details and the sales link', () => {
    const { container } = render(() => <PlanPicker proPrice={null} onSelect={vi.fn()} />);
    const enterpriseCard = container.querySelectorAll<HTMLButtonElement>('.plan-picker__card')[2];

    fireEvent.click(enterpriseCard);

    expect(screen.getByText('Custom')).toBeDefined();
    expect(screen.getByText('SSO / SAML')).toBeDefined();
    const link = container.querySelector('.plan-picker__cta') as HTMLAnchorElement;
    expect(link.textContent).toBe('Talk to sales');
    expect(link.getAttribute('href')).toBe('https://manifest.build/pricing');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('falls back to a Pro label and disables the CTA while busy', () => {
    const { container } = render(() => <PlanPicker proPrice={null} busy onSelect={vi.fn()} />);
    const cta = container.querySelector('.plan-picker__cta') as HTMLButtonElement;

    expect(screen.getAllByText('Pro').length).toBeGreaterThan(0);
    expect(cta.disabled).toBe(true);
    expect(cta.querySelector('.spinner')).not.toBeNull();
  });

  it('renders the free request limit with Russian locale grouping', async () => {
    await setLocale('ru');
    const { container } = render(() => (
      <PlanPicker proPrice={monthlyUsd} onSelect={vi.fn()} />
    ));
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.plan-picker__card')[0]);

    expect(container.textContent).toMatch(/10[\u00a0\u202f]000 маршрутизируемых запросов/);
  });

  it('reformats the loaded Pro price when the locale changes', async () => {
    const { container } = render(() => (
      <PlanPicker proPrice={monthlyUsd} onSelect={vi.fn()} />
    ));
    expect(container.querySelectorAll('.plan-picker__amount')[1]?.textContent).toBe('$20');

    await setLocale('ru');

    expect(container.querySelectorAll('.plan-picker__amount')[1]?.textContent).toMatch(
      /^20[\s\u00a0\u202f]?\$$/,
    );
  });
});
