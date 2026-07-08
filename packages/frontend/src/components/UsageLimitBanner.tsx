import { A } from '@solidjs/router';
import { Show, createResource, type Component } from 'solid-js';
import { getBillingStatus } from '../services/api/billing.js';

const UsageLimitBanner: Component = () => {
  const [billing] = createResource(async () => {
    try {
      return await getBillingStatus();
    } catch {
      return null;
    }
  });

  const ratio = () => {
    const b = billing();
    if (!b?.enabled || b.plan !== 'free' || b.requests.limit == null) return 0;
    return (b.requests.used ?? 0) / b.requests.limit;
  };

  const atLimit = () => ratio() >= 1;
  const nearLimit = () => ratio() >= 0.8 && ratio() < 1;

  return (
    <Show when={nearLimit() || atLimit()}>
      <div
        class="usage-limit-banner"
        classList={{ 'usage-limit-banner--danger': atLimit() }}
      >
        <span class="usage-limit-banner__text">
          {atLimit()
            ? "You've reached your monthly limit. Requests are being blocked."
            : "You're limited to 10,000 requests this month. Upgrade for unlimited."}
        </span>
        <A href="/upgrade" class="btn btn--outline btn--sm usage-limit-banner__btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2m0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8"/><path d="m8 12 1.41 1.41L11 11.83V17h2v-5.17l1.59 1.59L16 12l-4-4z"/></svg>
          Upgrade plan
        </A>
      </div>
    </Show>
  );
};

export default UsageLimitBanner;
