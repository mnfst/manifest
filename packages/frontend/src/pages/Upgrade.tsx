import { Meta, Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { For, Show, createEffect, createResource, createSignal, type Component } from 'solid-js';
import { authClient } from '../services/auth-client.js';
import { getBillingStatus } from '../services/api/billing.js';
import { toast } from '../services/toast-store.js';

const fmt = (n: number) => n.toLocaleString('en-US');

const freeFeatures = [
  'Unlimited agents',
  '10,000 routed requests / month',
  'All providers, no restrictions',
  'Subscription providers',
  '7-day dashboard retention',
  'Community support via Discord',
];

const proFeatures = [
  'Unlimited agents',
  'Unlimited routed requests',
  '30-day dashboard retention',
  'Auto-fix gets Pro access first',
  'Budget alerts and notifications',
  'Basic support by email',
];

const enterpriseFeatures = [
  'Multiple seats and team management',
  'SSO / SAML',
  'Audit logs and custom retention',
  'Security reviews and custom BAAs',
];

const Upgrade: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [billingError, setBillingError] = createSignal(false);
  const [billing] = createResource(async () => {
    setBillingError(false);
    try {
      return await getBillingStatus({ cache: false });
    } catch {
      setBillingError(true);
      return undefined;
    }
  });
  const [billingBusy, setBillingBusy] = createSignal(false);

  const status = () => billing();
  const isRequestLimitEntry = () => searchParams.reason === 'requests';
  const proPrice = () => {
    const price = status()?.priceMonthlyUsd;
    return price != null ? `$${price}` : 'Pro';
  };

  createEffect(() => {
    const current = status();
    if (current && !current.enabled) {
      navigate('/', { replace: true });
    }
  });

  const handleUpgrade = async () => {
    setBillingBusy(true);
    try {
      const origin = window.location.origin;
      const cancelPath = `${window.location.pathname}${window.location.search}` || '/upgrade';
      await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: `${origin}/account?upgraded=1`,
        cancelUrl: `${origin}${cancelPath}`,
      });
    } catch {
      toast.error('Could not start the upgrade. Please try again.');
    } finally {
      setBillingBusy(false);
    }
  };

  return (
    <div class="account-modal account-modal--standalone">
      <Title>Upgrade to Pro - Manifest</Title>
      <Meta name="description" content="Upgrade Manifest to Pro for unlimited routed requests." />
      <div class="account-modal__inner account-modal__inner--upgrade">
        <div class="page-header upgrade-page-header">
          <div class="upgrade-page-header__copy">
            <span class="breadcrumb">Manifest Cloud</span>
            <h1>Choose your Manifest plan</h1>
            <p>
              Free to start. Upgrade when your routing volume needs unlimited requests, longer
              history, and production controls.
            </p>
          </div>
        </div>

        <Show when={isRequestLimitEntry()}>
          <div class="auth-form__success" role="status">
            You've used all 10,000 requests this month. Upgrade for unlimited routed requests.
          </div>
        </Show>

        <Show when={billing.loading}>
          <div class="settings-card">
            <div class="settings-card__body">
              <p class="settings-card__desc">Loading billing status...</p>
            </div>
          </div>
        </Show>

        <Show when={billingError()}>
          <div class="settings-card">
            <div class="settings-card__body">
              <p class="settings-card__desc">Could not load billing status. Please try again.</p>
            </div>
            <div class="settings-card__footer billing-footer">
              <span class="billing-footer__note">You can continue to the dashboard.</span>
              <button class="btn btn--outline btn--sm" onClick={() => navigate('/')}>
                Dashboard
              </button>
            </div>
          </div>
        </Show>

        <Show when={status()?.enabled && !billingError()}>
          <Show
            when={status()!.plan === 'pro'}
            fallback={
              <div class="upgrade-plan-grid">
                <section class="settings-card upgrade-plan-card">
                  <div class="upgrade-plan-card__body">
                    <div class="upgrade-plan-card__header">
                      <h2>Free</h2>
                    </div>
                    <div class="upgrade-plan-card__price">
                      <span class="upgrade-plan-card__amount">$0</span>
                      <span class="upgrade-plan-card__period">/month</span>
                    </div>
                    <p class="upgrade-plan-card__desc">
                      For getting started with routed AI calls and a clear monthly request cap.
                    </p>
                    <Show when={status()!.requests.used != null}>
                      <p class="upgrade-plan-card__usage">
                        {fmt(status()!.requests.used!)} used this month
                      </p>
                    </Show>
                    <ul class="upgrade-plan-card__features">
                      <For each={freeFeatures}>
                        {(feature) => (
                          <li>
                            <i class="bxd bx-check-circle" aria-hidden="true" />
                            <span>{feature}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                  <div class="settings-card__footer upgrade-plan-card__footer">
                    <button class="btn btn--outline btn--sm" onClick={() => navigate('/')}>
                      Continue on Free
                    </button>
                  </div>
                </section>

                <section class="settings-card upgrade-plan-card upgrade-plan-card--pro">
                  <span class="upgrade-plan-card__badge">Popular</span>
                  <div class="upgrade-plan-card__body">
                    <div class="upgrade-plan-card__header">
                      <h2>Pro</h2>
                    </div>
                    <div class="upgrade-plan-card__price">
                      <span class="upgrade-plan-card__amount">{proPrice()}</span>
                      <span class="upgrade-plan-card__period">/month</span>
                    </div>
                    <p class="upgrade-plan-card__desc">
                      For production projects that need unlimited routing and operational controls.
                    </p>
                    <ul class="upgrade-plan-card__features">
                      <For each={proFeatures}>
                        {(feature) => (
                          <li>
                            <i class="bxd bx-check-circle" aria-hidden="true" />
                            <span>{feature}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                  <div class="settings-card__footer upgrade-plan-card__footer">
                    <button
                      class="btn btn--primary"
                      disabled={billingBusy()}
                      onClick={handleUpgrade}
                    >
                      {billingBusy() ? <span class="spinner" /> : 'Upgrade to Pro'}
                    </button>
                  </div>
                </section>

                <section class="settings-card upgrade-plan-card">
                  <div class="upgrade-plan-card__body">
                    <div class="upgrade-plan-card__header">
                      <h2>Enterprise</h2>
                    </div>
                    <div class="upgrade-plan-card__price">
                      <span class="upgrade-plan-card__amount upgrade-plan-card__amount--custom">
                        Let's Talk
                      </span>
                    </div>
                    <p class="upgrade-plan-card__desc">
                      For teams that need seats, security, compliance, and dedicated support.
                    </p>
                    <ul class="upgrade-plan-card__features">
                      <For each={enterpriseFeatures}>
                        {(feature) => (
                          <li>
                            <i class="bxd bx-check-circle" aria-hidden="true" />
                            <span>{feature}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                  <div class="settings-card__footer upgrade-plan-card__footer">
                    <a
                      class="btn btn--outline btn--sm"
                      href="mailto:sebastien@manifest.build?subject=Manifest%20Enterprise"
                    >
                      Talk to sales
                    </a>
                  </div>
                </section>
              </div>
            }
          >
            <div class="settings-card">
              <div class="settings-card__body">
                <span class="settings-card__label-title">You're already on Pro</span>
                <p class="settings-card__desc">
                  This workspace already has unlimited routed requests.
                </p>
              </div>
              <div class="settings-card__footer billing-footer">
                <span class="billing-footer__note">Manage billing from Account.</span>
                <button class="btn btn--outline btn--sm" onClick={() => navigate('/account')}>
                  Account
                </button>
                <button class="btn btn--primary btn--sm" onClick={() => navigate('/')}>
                  Dashboard
                </button>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default Upgrade;
