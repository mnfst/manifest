import { renderToStaticMarkup } from 'react-dom/server';
import { PlanUsageEmail, SubscriptionPlanEmail } from './billing-plan-email';

describe('billing plan emails', () => {
  it('escapes user-controlled names in subscription emails', () => {
    const html = renderToStaticMarkup(
      SubscriptionPlanEmail({
        kind: 'subscription_confirmed',
        userName: '<img src=x onerror="alert(1)">',
        planName: 'Pro',
        appUrl: 'https://app.manifest.build',
        manageBillingUrl: 'https://app.manifest.build/account',
      }),
    );

    expect(html).not.toMatch(/<img src=x/);
    expect(html).toContain('&lt;img src=x');
  });

  it('renders plan-change subscription copy', () => {
    const html = renderToStaticMarkup(
      SubscriptionPlanEmail({
        kind: 'plan_changed',
        userName: 'Ada',
        planName: 'Pro',
        previousPlanName: 'Free',
        appUrl: 'https://app.manifest.build',
        manageBillingUrl: 'https://app.manifest.build/account',
      }),
    );

    expect(html).toContain('Your plan is now Pro');
    expect(html).toContain('from Free');
  });

  it('renders cancellation subscription copy without a period end', () => {
    const html = renderToStaticMarkup(
      SubscriptionPlanEmail({
        kind: 'cancellation_confirmed',
        userName: 'Ada',
        planName: 'Pro',
        appUrl: 'https://app.manifest.build',
        manageBillingUrl: 'https://app.manifest.build/account',
      }),
    );

    expect(html).toContain('Pro cancellation confirmed');
    expect(html).toContain('scheduled to end');
  });

  it('renders usage counts and reset date', () => {
    const html = renderToStaticMarkup(
      PlanUsageEmail({
        kind: 'requests_warning',
        userName: 'Ada',
        used: 8000,
        limit: 10000,
        periodEnd: '2026-08-01T00:00:00.000Z',
        appUrl: 'https://app.manifest.build',
      }),
    );

    expect(html).toContain('80% of monthly requests used');
    expect(html).toContain('8,000');
    expect(html).toContain('10,000');
    expect(html).toContain('Aug 1, 2026');
  });

  it('normalizes usage CTA URLs with trailing slashes', () => {
    const html = renderToStaticMarkup(
      PlanUsageEmail({
        kind: 'requests_limit_reached',
        used: 10000,
        limit: 10000,
        periodEnd: '2026-08-01T00:00:00.000Z',
        appUrl: 'https://app.manifest.build/',
      }),
    );

    expect(html).toContain('href="https://app.manifest.build/account"');
    expect(html).not.toContain('https://app.manifest.build//account');
  });
});
