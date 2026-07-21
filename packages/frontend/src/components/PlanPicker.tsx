import { For, Show, createMemo, createSignal, type Component } from 'solid-js';
import { formatBillingPrice, freeRequestLimitLabel } from '../services/billing-display.js';
import { formatNumber, t } from '../i18n/index.js';
import type { BillingPrice } from 'manifest-shared';

/* ── Plan data ───────────────────────────────────────── */

const freeFeatures = () => [
  t('plan.free.unlimitedAgents'),
  t('plan.free.requestLimit', { limit: freeRequestLimitLabel() }),
  t('plan.free.allProviders'),
  t('plan.free.subscriptionProviders'),
  t('plan.free.retention'),
  t('plan.free.autoFix'),
  t('plan.free.budgetAlerts'),
  t('plan.free.communitySupport'),
];

const proFeatures = () => [
  t('plan.pro.unlimitedRequests'),
  t('plan.pro.retention'),
  t('plan.pro.support'),
];

const enterpriseFeatures = () => [
  t('plan.enterprise.teamManagement'),
  t('plan.enterprise.sso'),
  t('plan.enterprise.auditLogs'),
  t('plan.enterprise.customRetention'),
  t('plan.enterprise.uptime'),
  t('plan.enterprise.compliance'),
  t('plan.enterprise.hipaa'),
  t('plan.enterprise.guardrails'),
  t('plan.enterprise.support'),
];

export type PlanId = 'free' | 'pro' | 'enterprise';

interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  period?: string;
  desc: string;
  features: string[];
  popular?: boolean;
}

export interface PlanPickerProps {
  /** Raw Pro price; formatted reactively for the active locale. */
  proPrice?: BillingPrice | null;
  /** Called when the user clicks "Choose this plan". */
  onSelect: (plan: PlanId) => void;
  /** Show a loading spinner on the selected plan's button. */
  busy?: boolean;
  /** Current usage (free plan only). */
  usedRequests?: number | null;
}

const PlanPicker: Component<PlanPickerProps> = (props) => {
  const [expanded, setExpanded] = createSignal<PlanId | null>('pro');
  const proPriceLabel = createMemo(() => formatBillingPrice(props.proPrice));

  const plans = (): PlanDef[] => [
    {
      id: 'free',
      name: t('plan.free.name'),
      price: '$0',
      period: t('plan.perMonth'),
      desc: t('plan.free.description'),
      features: freeFeatures(),
    },
    {
      id: 'pro',
      name: t('plan.pro.name'),
      price: proPriceLabel() ?? 'Pro',
      period: proPriceLabel() ? t('plan.perMonth') : undefined,
      desc: t('plan.pro.description'),
      features: proFeatures(),
      popular: true,
    },
    {
      id: 'enterprise',
      name: t('plan.enterprise.name'),
      price: t('plan.customPrice'),
      desc: t('plan.enterprise.description'),
      features: enterpriseFeatures(),
    },
  ];

  const toggle = (id: PlanId) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <div class="plan-picker">
      <For each={plans()}>
        {(plan) => {
          const isExpanded = () => expanded() === plan.id;

          return (
            <button
              type="button"
              class={`plan-picker__card${plan.popular ? ' plan-picker__card--pro' : ''}${isExpanded() ? ' plan-picker__card--expanded' : ''}`}
              onClick={() => toggle(plan.id)}
            >
              <div class="plan-picker__row">
                <div class="plan-picker__name">
                  <span class="plan-picker__radio">
                    <Show when={isExpanded()}>
                      <span class="plan-picker__radio-dot" />
                    </Show>
                  </span>
                  <span>{plan.name}</span>
                  <Show when={plan.popular}>
                    <span class="plan-picker__badge">{t('plan.popular')}</span>
                  </Show>
                </div>
                <div class="plan-picker__price-inline">
                  <span class="plan-picker__amount">{plan.price}</span>
                  <Show when={plan.period}>
                    <span class="plan-picker__period">{plan.period}</span>
                  </Show>
                </div>
              </div>

              <Show when={isExpanded()}>
                <div class="plan-picker__details">
                  <Show when={plan.id === 'free' && props.usedRequests != null}>
                    <p class="plan-picker__usage">
                      {t('plan.usedThisMonth', { count: formatNumber(props.usedRequests!) })}
                    </p>
                  </Show>
                  <ul class="plan-picker__features">
                    <For each={plan.features}>
                      {(feature) => (
                        <li>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            fill="#2632EF"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M9 15.59 4.71 11.3 3.3 12.71l5 5c.2.2.45.29.71.29s.51-.1.71-.29l11-11-1.41-1.41L9.02 15.59Z" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </Show>
            </button>
          );
        }}
      </For>

      <Show when={expanded()}>
        <Show
          when={expanded() !== 'enterprise'}
          fallback={
            <a
              class="auth-form__submit plan-picker__cta"
              href="https://manifest.build/pricing"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('plan.talkToSales')}
            </a>
          }
        >
          <button
            type="button"
            class="auth-form__submit plan-picker__cta"
            disabled={props.busy}
            onClick={() => props.onSelect(expanded()!)}
          >
            {props.busy ? <span class="spinner" /> : t('plan.choose')}
          </button>
        </Show>
      </Show>
    </div>
  );
};

export default PlanPicker;

export { freeFeatures, proFeatures, enterpriseFeatures };
