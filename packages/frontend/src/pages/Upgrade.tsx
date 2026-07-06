import { Meta, Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { Show, createEffect, createResource, createSignal, type Component } from 'solid-js';
import { authClient } from '../services/auth-client.js';
import { getBillingStatus } from '../services/api/billing.js';
import { toast } from '../services/toast-store.js';

const fmt = (n: number) => n.toLocaleString('en-US');

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
  const checkoutLabel = () => {
    const price = status()?.priceMonthlyUsd;
    return price != null ? `Upgrade to Pro - $${price}/mo` : 'Upgrade to Pro';
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
      await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: '/account?upgraded=1',
        cancelUrl: `${window.location.pathname}${window.location.search}` || '/upgrade',
      });
    } catch {
      toast.error('Could not start the upgrade. Please try again.');
    } finally {
      setBillingBusy(false);
    }
  };

  return (
    <div class="account-modal">
      <Title>Upgrade to Pro - Manifest</Title>
      <Meta name="description" content="Upgrade Manifest to Pro for unlimited routed requests." />
      <div class="account-modal__inner">
        <div class="page-header">
          <div>
            <h1>Upgrade to Pro</h1>
            <span class="breadcrumb">Choose the plan for this workspace</span>
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
              <>
                <h2 class="settings-section__title">Free</h2>
                <div class="settings-card">
                  <div class="billing-stats">
                    <div class="billing-stat">
                      <span class="billing-stat__label">Agents</span>
                      <span class="billing-stat__value">Unlimited agents</span>
                    </div>
                    <div class="billing-stat">
                      <span class="billing-stat__label">Requests</span>
                      <span class="billing-stat__value">10,000 routed requests / month</span>
                      <Show when={status()!.requests.used != null}>
                        <span class="billing-stat__meta">
                          {fmt(status()!.requests.used!)} used this month
                        </span>
                      </Show>
                    </div>
                  </div>
                  <div class="settings-card__footer billing-footer">
                    <span class="billing-footer__note">Keep using Manifest on Free.</span>
                    <button class="btn btn--outline btn--sm" onClick={() => navigate('/')}>
                      Continue on Free
                    </button>
                  </div>
                </div>

                <h2 class="settings-section__title">Pro</h2>
                <div class="settings-card">
                  <div class="billing-stats">
                    <div class="billing-stat">
                      <span class="billing-stat__label">Agents</span>
                      <span class="billing-stat__value">Unlimited agents</span>
                    </div>
                    <div class="billing-stat">
                      <span class="billing-stat__label">Requests</span>
                      <span class="billing-stat__value">Unlimited routed requests</span>
                    </div>
                  </div>
                  <div class="settings-card__footer billing-footer">
                    <span class="billing-footer__note">
                      Pro removes the monthly routed-request limit.
                    </span>
                    <button
                      class="btn btn--primary btn--sm"
                      disabled={billingBusy()}
                      onClick={handleUpgrade}
                    >
                      {billingBusy() ? <span class="spinner" /> : checkoutLabel()}
                    </button>
                  </div>
                </div>
              </>
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
