import { Meta, Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { For, Show, createEffect, createResource, createSignal, type Component } from 'solid-js';
import { type PlanId } from '../components/PlanPicker.jsx';
import { authClient } from '../services/auth-client.js';
import { getBillingStatus } from '../services/api/billing.js';
import { toast } from '../services/toast-store.js';
import { FREE_REQUEST_LIMIT, formatBillingPrice } from '../services/billing-display.js';
import { formatNumber, t } from '../i18n/index.js';

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
  const proPrice = () => formatBillingPrice(status()?.priceMonthly);
  const freeFeatures = () => [
    t('pages.upgrade.feature.unlimitedAgents'),
    t('pages.upgrade.feature.freeRequests', { limit: formatNumber(FREE_REQUEST_LIMIT) }),
    t('pages.upgrade.feature.allProviders'),
    t('pages.upgrade.feature.subscriptionProviders'),
    t('pages.upgrade.feature.retention7'),
    t('pages.upgrade.feature.autoFix'),
    t('pages.upgrade.feature.budgetAlerts'),
    t('pages.upgrade.feature.communitySupport'),
  ];
  const proFeatures = () => [
    t('pages.upgrade.feature.unlimitedRequests'),
    t('pages.upgrade.feature.retention365'),
    t('pages.upgrade.feature.basicSupport'),
  ];
  const enterpriseFeatures = () => [
    t('pages.upgrade.feature.multipleSeats'),
    t('pages.upgrade.feature.sso'),
    t('pages.upgrade.feature.auditLogs'),
    t('pages.upgrade.feature.customRetention'),
    t('pages.upgrade.feature.uptimeSla'),
    t('pages.upgrade.feature.compliance'),
    t('pages.upgrade.feature.hipaa'),
    t('pages.upgrade.feature.customGuardrails'),
    t('pages.upgrade.feature.dedicatedSupport'),
  ];

  createEffect(() => {
    const current = status();
    if (current && !current.enabled) {
      navigate('/', { replace: true });
    }
  });

  const handlePlanSelect = async (plan: PlanId) => {
    if (plan === 'free') {
      navigate('/');
      return;
    }
    if (plan === 'enterprise') {
      return;
    }
    setBillingBusy(true);
    try {
      const origin = window.location.origin;
      const cancelPath = `${window.location.pathname}${window.location.search}` || '/upgrade';
      const res = await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: `${origin}/overview?upgraded=1`,
        cancelUrl: `${origin}${cancelPath}`,
      });
      const error = (res as { error?: unknown } | undefined)?.error;
      if (error) throw error;
    } catch {
      toast.error(t('pages.upgrade.error.start'));
    } finally {
      setBillingBusy(false);
    }
  };

  return (
    <div class="account-modal account-modal--standalone">
      <Title>{t('pages.upgrade.metaTitle')}</Title>
      <Meta name="description" content={t('pages.upgrade.metaDescription')} />
      <div class="account-modal__inner account-modal__inner--upgrade">
        <Show when={window.history.length > 1}>
          <button
            class="upgrade-back"
            onClick={() => {
              const referrer = document.referrer;
              if (referrer && new URL(referrer).origin === window.location.origin) {
                window.history.back();
              } else {
                navigate('/');
              }
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
            </svg>
            {t('pages.upgrade.back')}
          </button>
        </Show>
        <div class="page-header upgrade-page-header upgrade-page-header--centered">
          <div class="upgrade-page-header__copy">
            <h1>{t('pages.upgrade.title')}</h1>
            <p>{t('pages.upgrade.subtitle')}</p>
          </div>
        </div>

        <Show when={isRequestLimitEntry()}>
          <p class="upgrade-limit-notice">
            {t('pages.upgrade.limitNotice', {
              limit: formatNumber(status()?.requests.limit ?? FREE_REQUEST_LIMIT),
            })}
          </p>
        </Show>

        <Show when={billing.loading}>
          <div class="settings-card">
            <div class="settings-card__body">
              <p class="settings-card__desc">{t('pages.upgrade.loading')}</p>
            </div>
          </div>
        </Show>

        <Show when={billingError()}>
          <div class="settings-card">
            <div class="settings-card__body">
              <p class="settings-card__desc">{t('pages.upgrade.loadError')}</p>
            </div>
            <div class="settings-card__footer billing-footer">
              <span class="billing-footer__note">{t('pages.upgrade.continueDashboard')}</span>
              <button class="btn btn--outline btn--sm" onClick={() => navigate('/')}>
                {t('pages.upgrade.dashboard')}
              </button>
            </div>
          </div>
        </Show>

        <Show when={status()?.enabled && !billingError()}>
          <Show
            when={status()!.plan === 'pro'}
            fallback={
              <>
                <div class="upgrade-plan-grid">
                  <section class="settings-card upgrade-plan-card">
                    <div class="upgrade-plan-card__header">
                      <h2>{t('pages.upgrade.free')}</h2>
                    </div>
                    <div class="upgrade-plan-card__price">
                      <span class="upgrade-plan-card__amount">$0</span>
                      <span class="upgrade-plan-card__period">{t('pages.upgrade.perMonth')}</span>
                    </div>
                    <p class="upgrade-plan-card__desc">{t('pages.upgrade.freeDescription')}</p>
                    <div class="upgrade-plan-card__cta">
                      <button class="btn btn--outline" onClick={() => navigate('/')}>
                        {t('pages.upgrade.useFree')}
                      </button>
                    </div>
                    <div class="upgrade-plan-card__bottom">
                      <div class="upgrade-plan-card__divider" />
                      <ul class="upgrade-plan-card__features">
                        <For each={freeFeatures()}>
                          {(feature) => (
                            <li>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
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
                  </section>

                  <section class="settings-card upgrade-plan-card upgrade-plan-card--pro">
                    <span class="upgrade-plan-card__badge">{t('pages.upgrade.popular')}</span>
                    <div class="upgrade-plan-card__header">
                      <h2>{t('pages.upgrade.pro')}</h2>
                    </div>
                    <div class="upgrade-plan-card__price">
                      <span class="upgrade-plan-card__amount">
                        {proPrice() ?? t('pages.upgrade.pro')}
                      </span>
                      <Show when={proPrice()}>
                        <span class="upgrade-plan-card__period">{t('pages.upgrade.perMonth')}</span>
                      </Show>
                    </div>
                    <p class="upgrade-plan-card__desc">{t('pages.upgrade.proDescription')}</p>
                    <div class="upgrade-plan-card__cta">
                      <button
                        class="btn btn--primary"
                        disabled={billingBusy()}
                        onClick={() => handlePlanSelect('pro')}
                      >
                        {billingBusy() ? <span class="spinner" /> : t('pages.upgrade.upgradePro')}
                      </button>
                      <span class="upgrade-plan-card__no-commitment">
                        {t('pages.upgrade.noCommitment')}
                      </span>
                    </div>
                    <div class="upgrade-plan-card__bottom">
                      <div class="upgrade-plan-card__divider" />
                      <p class="upgrade-plan-card__features-intro">{t('pages.upgrade.proIntro')}</p>
                      <ul class="upgrade-plan-card__features">
                        <For each={proFeatures()}>
                          {(feature) => (
                            <li>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
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
                  </section>

                  <section class="settings-card upgrade-plan-card">
                    <div class="upgrade-plan-card__header">
                      <h2>{t('pages.upgrade.enterprise')}</h2>
                    </div>
                    <div class="upgrade-plan-card__price">
                      <span class="upgrade-plan-card__amount upgrade-plan-card__amount--custom">
                        {t('pages.upgrade.letsTalk')}
                      </span>
                    </div>
                    <p class="upgrade-plan-card__desc">
                      {t('pages.upgrade.enterpriseDescription')}
                    </p>
                    <div class="upgrade-plan-card__cta">
                      <a
                        class="btn btn--primary"
                        href="https://manifest.build/pricing"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('pages.upgrade.talkToSales')}
                      </a>
                    </div>
                    <div class="upgrade-plan-card__bottom">
                      <div class="upgrade-plan-card__divider" />
                      <ul class="upgrade-plan-card__features">
                        <For each={enterpriseFeatures()}>
                          {(feature) => (
                            <li>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
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
                  </section>
                </div>
                <p class="upgrade-terms">
                  {t('pages.upgrade.termsPrefix')}{' '}
                  <a href="https://manifest.build/terms" target="_blank" rel="noopener noreferrer">
                    {t('pages.upgrade.terms')}
                  </a>
                </p>
              </>
            }
          >
            <div class="upgrade-pro-current">
              <p class="upgrade-pro-current__status">
                {t('pages.upgrade.currentProPrefix')} <strong>{t('pages.upgrade.proPlan')}</strong>.{' '}
                {t('pages.upgrade.manageFrom')}{' '}
                <a href="/account" class="billing-footer__link">
                  {t('pages.upgrade.account')}
                </a>
                .
              </p>
              <p class="upgrade-pro-current__status">{t('pages.upgrade.enterprisePrompt')}</p>

              <div class="upgrade-pro-current__card">
                <section class="settings-card upgrade-plan-card">
                  <div class="upgrade-plan-card__header">
                    <h2>{t('pages.upgrade.enterprise')}</h2>
                  </div>
                  <div class="upgrade-plan-card__price">
                    <span class="upgrade-plan-card__amount upgrade-plan-card__amount--custom">
                      {t('pages.upgrade.letsTalk')}
                    </span>
                  </div>
                  <p class="upgrade-plan-card__desc">{t('pages.upgrade.negotiable')}</p>
                  <div class="upgrade-plan-card__cta">
                    <a
                      class="btn btn--primary"
                      href="https://manifest.build/pricing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('pages.upgrade.talkToSales')}
                    </a>
                  </div>
                  <div class="upgrade-plan-card__bottom">
                    <div class="upgrade-plan-card__divider" />
                    <ul class="upgrade-plan-card__features">
                      {enterpriseFeatures().map((feature) => (
                        <li>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="#2632EF"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M9 15.59 4.71 11.3 3.3 12.71l5 5c.2.2.45.29.71.29s.51-.1.71-.29l11-11-1.41-1.41L9.02 15.59Z" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default Upgrade;
