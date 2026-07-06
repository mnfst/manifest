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
});
