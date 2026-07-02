import { createSignal, Show, type Component } from 'solid-js';
import { authClient } from '../services/auth-client.js';
import { toast } from '../services/toast-store.js';
import type { BillingStatus } from '../services/api/billing.js';

/**
 * Paywall shown inside the agent-creation modals when the tenant has hit its
 * plan's agent limit. Context-aware: a free tenant sees the Pro benefits + an
 * "Upgrade to Pro" CTA; a Pro tenant that is already at the Pro ceiling just
 * sees a "reached the Pro limit" message (there is no higher self-serve tier
 * yet). A "Compare plans" link into /account#billing is always shown.
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

  const limit = () => props.status.agents.limit ?? 0;

  return (
    <div class="upgrade-panel">
      <Show
        when={props.status.plan === 'free'}
        fallback={
          <p class="modal-card__desc">
            You've reached the Pro limit of {limit()} agents. A higher tier is on the way — contact
            us if you need more agents now.
          </p>
        }
      >
        <p class="modal-card__desc">
          Free includes {limit()} agent{limit() === 1 ? '' : 's'}.
        </p>
        <p class="modal-card__desc">
          Pro{props.status.priceMonthlyUsd != null ? ` ($${props.status.priceMonthlyUsd}/mo)` : ''}:
          10 agents and 500,000 requests per month.
        </p>
        <div class="modal-card__footer">
          <button class="btn btn--primary btn--sm" disabled={busy()} onClick={upgrade}>
            {busy() ? <span class="spinner" /> : 'Upgrade to Pro'}
          </button>
        </div>
      </Show>
      <p class="modal-card__desc">
        <a href="/account#billing">Compare plans</a>
      </p>
    </div>
  );
};
