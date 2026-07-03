import { createSignal, For, Show, type Component } from 'solid-js';
import { PLAN_LIMITS } from 'manifest-shared';
import { authClient } from '../services/auth-client.js';
import { toast } from '../services/toast-store.js';
import type { BillingStatus } from '../services/api/billing.js';

const fmtInt = (n: number) => n.toLocaleString('en-US');

/** Booking link for the "Let's Talk" tier — the same sales contact used elsewhere. */
const CONTACT_URL = 'https://calendly.com/sebastien-manifest/30min';
const TERMS_URL = 'https://manifest.build/terms';
const PRIVACY_URL = 'https://manifest.build/privacy';

// Free numbers come from the enforceable PLAN_LIMITS catalog; the rest are plan
// marketing features (retention, support, auto-fix, SSO, …) that aren't numeric
// limits, so they live here as copy that mirrors the pricing page.
const FREE_FEATURES = [
  `${fmtInt(Number(PLAN_LIMITS.free.agents))} agent`,
  `${fmtInt(Number(PLAN_LIMITS.free.requestsPerMonth))} routed requests / month`,
  '7-day dashboard history',
  'Community support (Discord)',
];
const PRO_FEATURES = [
  'Unlimited agents',
  'Unlimited routed requests',
  '30-day dashboard history',
  'Auto-fix (Pro gets it first)',
  'Priority email support',
];
const ENTERPRISE_FEATURES = [
  'Everything in Pro',
  'Seats & team management',
  'SSO / SAML',
  'Audit logs & contractual SLA',
  'Dedicated support',
];

/**
 * Paywall shown inside the agent-creation modals when a Free tenant hits the
 * 1-agent limit. Presents the Free / Pro / Let's Talk comparison: the Pro card
 * carries the "Upgrade to Pro" Stripe checkout CTA, and the Let's Talk card
 * links to a sales conversation (custom pricing — seats, SSO, compliance).
 * Since Pro is unlimited, a Pro tenant never reaches this panel; the non-free
 * fallback stays as a short "let's talk" message for any override edge case.
 * Plan numbers come from the shared PLAN_LIMITS catalog; the Pro price comes
 * from the live billing status (null when Stripe is unreachable).
 */
export const UpgradePanel: Component<{ status: BillingStatus }> = (props) => {
  const [busy, setBusy] = createSignal(false);

  const upgrade = async () => {
    setBusy(true);
    try {
      await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: '/account?upgraded=1',
        cancelUrl: window.location.pathname,
      });
    } catch {
      toast.error('Could not start the upgrade. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="upgrade-panel">
      <Show
        when={props.status.plan === 'free'}
        fallback={
          <p class="modal-card__desc">
            You've reached your plan's agent limit. Need more?{' '}
            <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
              Let's talk
            </a>{' '}
            about a plan that fits your team.
          </p>
        }
      >
        <div class="plan-cards plan-cards--trio">
          <div class="plan-card">
            <div class="plan-card__head">
              <span class="plan-card__name">Free</span>
              <span class="plan-card__badge plan-card__badge--current">Current plan</span>
            </div>
            <div class="plan-card__price">$0</div>
            <ul class="plan-card__features">
              <For each={FREE_FEATURES}>{(f) => <li class="plan-card__feature">{f}</li>}</For>
            </ul>
          </div>

          <div class="plan-card plan-card--recommended">
            <div class="plan-card__head">
              <span class="plan-card__name">Pro</span>
              <span class="plan-card__badge plan-card__badge--recommended">Recommended</span>
            </div>
            <div class="plan-card__price">
              <Show when={props.status.priceMonthlyUsd != null} fallback={<>&nbsp;</>}>
                ${props.status.priceMonthlyUsd}
                <span class="plan-card__price-suffix">/mo</span>
              </Show>
            </div>
            <ul class="plan-card__features">
              <For each={PRO_FEATURES}>{(f) => <li class="plan-card__feature">{f}</li>}</For>
            </ul>
            <button
              class="btn btn--primary btn--sm plan-card__cta"
              disabled={busy()}
              onClick={upgrade}
            >
              {busy() ? <span class="spinner" /> : 'Upgrade to Pro'}
            </button>
          </div>

          <div class="plan-card">
            <div class="plan-card__head">
              <span class="plan-card__name">Let's Talk</span>
            </div>
            <div class="plan-card__price plan-card__price--custom">Custom</div>
            <ul class="plan-card__features">
              <For each={ENTERPRISE_FEATURES}>{(f) => <li class="plan-card__feature">{f}</li>}</For>
            </ul>
            <a
              class="btn btn--ghost btn--sm plan-card__cta"
              href={CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Let's talk
            </a>
          </div>
        </div>
        <p class="upgrade-panel__consent">
          By upgrading, you agree to our{' '}
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
            Terms
          </a>{' '}
          and{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          .
        </p>
      </Show>
    </div>
  );
};
