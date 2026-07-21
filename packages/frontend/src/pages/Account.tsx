import {
  createEffect,
  createResource,
  createSignal,
  onMount,
  Show,
  type Component,
} from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { authClient } from '../services/auth-client.js';
import { getBillingStatus, updateBillingEmailPreferences } from '../services/api/billing.js';
import { toast } from '../services/toast-store.js';
import { FREE_REQUEST_LIMIT, formatBillingPriceWithInterval } from '../services/billing-display.js';
import { formatDate, formatNumber, t } from '../i18n/index.js';

const Account: Component = () => {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [copied, setCopied] = createSignal(false);
  const [theme, setTheme] = createSignal<'light' | 'dark' | 'system'>('system');
  const [currentPassword, setCurrentPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [pwError, setPwError] = createSignal('');
  const [pwBusy, setPwBusy] = createSignal(false);

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    setPwError('');

    const current = currentPassword();
    const next = newPassword();

    if (next !== confirmPassword()) {
      setPwError(t('pages.account.error.passwordMismatch'));
      return;
    }
    if (next.length < 8) {
      setPwError(t('pages.account.error.passwordLength'));
      return;
    }
    if (next === current) {
      setPwError(t('pages.account.error.passwordSame'));
      return;
    }

    setPwBusy(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });

      if (error) {
        setPwError(error.message ?? t('pages.account.error.passwordChange'));
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('pages.account.passwordChanged'));
    } catch {
      setPwError(t('pages.account.error.passwordChange'));
    } finally {
      setPwBusy(false);
    }
  };
  const [billing, { refetch: refetchBilling }] = createResource(() => getBillingStatus());
  const [accounts] = createResource(() => authClient.listAccounts());
  const hasCredentialAccount = () =>
    (accounts()?.data ?? []).some((a) => a.providerId === 'credential');
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingBusy, setBillingBusy] = createSignal(false);
  const [emailPrefsBusy, setEmailPrefsBusy] = createSignal(false);
  const [usageAlertsEnabled, setUsageAlertsEnabled] = createSignal(true);

  const userName = () => session()?.data?.user?.name ?? '';
  const userEmail = () => session()?.data?.user?.email ?? '';
  const userId = () => session()?.data?.user?.id ?? '';
  const proPriceWithInterval = () => formatBillingPriceWithInterval(billing()?.priceMonthly);

  createEffect(() => {
    const prefs = billing()?.emailPreferences;
    if (prefs) setUsageAlertsEnabled(prefs.usageAlerts);
  });

  onMount(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    } else {
      setTheme('system');
    }

    if (searchParams['upgraded'] === '1') {
      toast.success(t('pages.account.welcomePro'));
      setSearchParams({ upgraded: undefined }, { replace: true });
    }
  });

  const handleUpgrade = async () => {
    setBillingBusy(true);
    try {
      const origin = window.location.origin;
      const res = await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: `${origin}/account?upgraded=1`,
        cancelUrl: `${origin}/account`,
      });
      const error = (res as { error?: unknown } | undefined)?.error;
      if (error) throw error;
    } catch {
      toast.error(t('pages.account.error.upgrade'));
    } finally {
      setBillingBusy(false);
    }
  };

  const handleManageBilling = async () => {
    setBillingBusy(true);
    // Open the tab synchronously inside the click handler so it keeps the user
    // activation — a popup blocker would kill a window.open() that ran after the
    // awaited portal call. We navigate this placeholder once the URL resolves.
    // Drop `opener` for the same isolation `noopener` would give us.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      // disableRedirect returns the portal URL instead of navigating the current
      // tab, so we can send the new tab there and keep the dashboard open.
      const res = await authClient.subscription.billingPortal({
        returnUrl: `${window.location.origin}/account`,
        disableRedirect: true,
      });
      const url = res?.data?.url;
      if (url) {
        if (tab) tab.location.href = url;
        else window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        tab?.close();
        toast.error(t('pages.account.error.billingPortal'));
      }
    } catch {
      tab?.close();
      toast.error(t('pages.account.error.billingPortal'));
    } finally {
      setBillingBusy(false);
    }
  };

  const applyTheme = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);
    if (value === 'system') {
      localStorage.removeItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      localStorage.setItem('theme', value);
      document.documentElement.classList.toggle('dark', value === 'dark');
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(userId());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUsageAlertsChange = async (enabled: boolean) => {
    const previous = usageAlertsEnabled();
    setUsageAlertsEnabled(enabled);
    setEmailPrefsBusy(true);
    try {
      const saved = await updateBillingEmailPreferences({ usageAlerts: enabled });
      setUsageAlertsEnabled(saved.usageAlerts);
      await refetchBilling();
      toast.success(t('pages.account.emailPreferencesSaved'));
    } catch {
      setUsageAlertsEnabled(previous);
    } finally {
      setEmailPrefsBusy(false);
    }
  };

  return (
    <div class="account-modal">
      <Title>{t('pages.account.metaTitle')}</Title>
      <Meta name="description" content={t('pages.account.metaDescription')} />
      <div class="account-modal__inner">
        <button class="btn btn--ghost btn--sm account-back-btn" onClick={() => navigate(-1)}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M14.71 7.29a.996.996 0 0 0-1.41 0l-4 4a.996.996 0 0 0 0 1.41l4 4c.2.2.45.29.71.29s.51-.1.71-.29a.996.996 0 0 0 0-1.41L11.43 12l3.29-3.29a.996.996 0 0 0 0-1.41Z" />
          </svg>
          {t('pages.account.back')}
        </button>
        <div class="page-header">
          <div>
            <h1>{t('pages.account.title')}</h1>
            <span class="breadcrumb">{t('pages.account.subtitle')}</span>
          </div>
        </div>

        {/* Profile Information */}
        <h2 class="settings-section__title">{t('pages.account.profile')}</h2>

        <div class="settings-card">
          <div class="settings-card__row">
            <div class="settings-card__label">
              <span class="settings-card__label-title">{t('pages.account.displayName')}</span>
              <span class="settings-card__label-desc">
                {t('pages.account.displayNameDescription')}
              </span>
            </div>
            <div class="settings-card__control">
              <input
                class="settings-card__input"
                type="text"
                aria-label={t('pages.account.displayName')}
                value={userName()}
                readonly
              />
            </div>
          </div>
          <div class="settings-card__row">
            <div class="settings-card__label">
              <span class="settings-card__label-title">{t('pages.account.email')}</span>
              <span class="settings-card__label-desc">{t('pages.account.emailDescription')}</span>
            </div>
            <div class="settings-card__control">
              <input
                class="settings-card__input"
                type="email"
                aria-label={t('pages.account.email')}
                value={userEmail()}
                readonly
              />
            </div>
          </div>
          <div class="settings-card__footer">
            <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
              {t('pages.account.profileManaged')}
            </span>
          </div>
        </div>

        {/* Security */}
        <Show when={hasCredentialAccount()}>
          <h2 class="settings-section__title">{t('pages.account.security')}</h2>

          <form class="settings-card" onSubmit={handleChangePassword}>
            <div class="settings-card__row">
              <div class="settings-card__label">
                <span class="settings-card__label-title">{t('pages.account.currentPassword')}</span>
                <span class="settings-card__label-desc">
                  {t('pages.account.currentPasswordDescription')}
                </span>
              </div>
              <div class="settings-card__control">
                <input
                  class="settings-card__input"
                  type="password"
                  autocomplete="current-password"
                  aria-label={t('pages.account.currentPassword')}
                  value={currentPassword()}
                  onInput={(e) => setCurrentPassword(e.currentTarget.value)}
                  required
                />
              </div>
            </div>
            <div class="settings-card__row">
              <div class="settings-card__label">
                <span class="settings-card__label-title">{t('pages.account.newPassword')}</span>
                <span class="settings-card__label-desc">
                  {t('pages.account.newPasswordDescription')}
                </span>
              </div>
              <div class="settings-card__control">
                <input
                  class="settings-card__input"
                  type="password"
                  autocomplete="new-password"
                  aria-label={t('pages.account.newPassword')}
                  value={newPassword()}
                  onInput={(e) => setNewPassword(e.currentTarget.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div class="settings-card__row">
              <div class="settings-card__label">
                <span class="settings-card__label-title">{t('pages.account.confirmPassword')}</span>
                <span class="settings-card__label-desc">
                  {t('pages.account.confirmPasswordDescription')}
                </span>
              </div>
              <div class="settings-card__control">
                <input
                  class="settings-card__input"
                  type="password"
                  autocomplete="new-password"
                  aria-label={t('pages.account.confirmPassword')}
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div class="settings-card__footer account-security-footer">
              <span class="account-security-error" role="alert">
                {pwError()}
              </span>
              <button class="btn btn--primary btn--sm" type="submit" disabled={pwBusy()}>
                {pwBusy() ? <span class="spinner" /> : t('pages.account.changePassword')}
              </button>
            </div>
          </form>
        </Show>

        {/* Workspace ID */}
        <h2 class="settings-section__title">{t('pages.account.workspace')}</h2>

        <div class="settings-card">
          <div class="settings-card__body">
            <p class="settings-card__desc">{t('pages.account.workspaceDescription')}</p>
            <div class="settings-card__id-row">
              <code class="settings-card__id-value">{userId()}</code>
              <button
                class="settings-card__copy-btn"
                onClick={copyId}
                title={t('pages.account.copy')}
                aria-label={
                  copied() ? t('pages.account.copied') : t('pages.account.copyWorkspaceId')
                }
              >
                {copied() ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Billing */}
        <Show when={billing()?.enabled}>
          <h2 class="settings-section__title" id="billing">
            {t('pages.account.billing')}
          </h2>

          <div class="settings-card">
            <div class="billing-stats">
              <div class="billing-stat">
                <span class="billing-stat__label">{t('pages.account.currentPlan')}</span>
                <span class="billing-stat__value">
                  {billing()!.plan === 'pro'
                    ? t('pages.account.plan.pro')
                    : t('pages.account.plan.free')}
                  {billing()!.plan === 'pro' && proPriceWithInterval()
                    ? ` · ${proPriceWithInterval()}`
                    : ''}
                </span>
                <Show when={billing()!.cancelAtPeriodEnd && billing()!.subscriptionPeriodEnd}>
                  <span class="billing-stat__cancel">
                    {t('pages.account.proUntil', {
                      date: formatDate(new Date(billing()!.subscriptionPeriodEnd!), {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      }),
                    })}
                  </span>
                </Show>
              </div>

              <div class="billing-stat">
                <span class="billing-stat__label">{t('pages.account.requests')}</span>
                <span class="billing-stat__value">
                  {billing()!.requests.limit != null
                    ? billing()!.requests.used != null
                      ? t('pages.account.requestUsage', {
                          used: formatNumber(billing()!.requests.used!),
                          limit: formatNumber(billing()!.requests.limit!),
                        })
                      : formatNumber(billing()!.requests.limit!)
                    : t('pages.account.unlimited')}
                </span>
                <Show when={billing()!.requests.limit != null && billing()!.requests.periodEnd}>
                  <span class="billing-stat__meta">
                    {t('pages.account.resets', {
                      date: formatDate(new Date(billing()!.requests.periodEnd!), {
                        month: 'short',
                        day: 'numeric',
                      }),
                    })}
                  </span>
                </Show>
              </div>
            </div>

            <div class="settings-card__footer billing-footer">
              <span class="billing-footer__note">
                {billing()!.plan === 'free'
                  ? t('pages.account.freePlanNote', { limit: formatNumber(FREE_REQUEST_LIMIT) })
                  : t('pages.account.proPlanNote')}
              </span>
              <Show
                when={billing()!.plan === 'free'}
                fallback={
                  <div class="billing-footer__actions">
                    <button
                      class="btn btn--outline btn--sm"
                      disabled={billingBusy()}
                      onClick={handleManageBilling}
                    >
                      {billingBusy() ? (
                        <span class="spinner" />
                      ) : (
                        t('pages.account.manageSubscription')
                      )}
                    </button>
                    <button
                      class="btn btn--outline btn--sm"
                      disabled={billingBusy()}
                      onClick={handleManageBilling}
                    >
                      {billingBusy() ? <span class="spinner" /> : t('pages.account.viewInvoices')}
                    </button>
                  </div>
                }
              >
                <button
                  class="btn btn--primary btn--sm"
                  disabled={billingBusy()}
                  onClick={handleUpgrade}
                >
                  {t('pages.account.upgrade')}
                  {proPriceWithInterval() ? ` · ${proPriceWithInterval()}` : ''}
                </button>
              </Show>
            </div>
          </div>
        </Show>

        {/* Email Preferences */}
        <Show when={billing()?.enabled}>
          <h2 class="settings-section__title" id="email-preferences">
            {t('pages.account.emailPreferences')}
          </h2>

          <div class="settings-card">
            <div class="settings-card__row">
              <div class="settings-card__label">
                <span class="settings-card__label-title">{t('pages.account.usageAlerts')}</span>
                <span class="settings-card__label-desc">
                  {t('pages.account.usageAlertsDescription')}
                </span>
              </div>
              <div class="settings-card__control settings-card__control--end">
                <label
                  class="notification-toggle account-email-toggle"
                  classList={{ 'account-email-toggle--disabled': emailPrefsBusy() }}
                  title={t('pages.account.usageAlerts')}
                >
                  <input
                    type="checkbox"
                    checked={usageAlertsEnabled()}
                    disabled={emailPrefsBusy()}
                    onChange={(e) => void handleUsageAlertsChange(e.currentTarget.checked)}
                  />
                  <span class="notification-toggle__slider" aria-hidden="true" />
                  <span class="sr-only">{t('pages.account.receiveUsageAlerts')}</span>
                </label>
              </div>
            </div>
            <div class="settings-card__footer account-email-footer">
              {t('pages.account.emailLifecycleNote')}
            </div>
          </div>
        </Show>

        {/* Appearance */}
        <h2 class="settings-section__title">{t('pages.account.appearance')}</h2>

        <div class="settings-card">
          <div class="settings-card__body">
            <p class="settings-card__desc">{t('pages.account.appearanceDescription')}</p>
            <div class="theme-picker">
              <button
                class="theme-picker__option"
                classList={{ 'theme-picker__option--active': theme() === 'light' }}
                onClick={() => applyTheme('light')}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
                {t('pages.account.theme.light')}
              </button>
              <button
                class="theme-picker__option"
                classList={{ 'theme-picker__option--active': theme() === 'dark' }}
                onClick={() => applyTheme('dark')}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
                {t('pages.account.theme.dark')}
              </button>
              <button
                class="theme-picker__option"
                classList={{ 'theme-picker__option--active': theme() === 'system' }}
                onClick={() => applyTheme('system')}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                </svg>
                {t('pages.account.theme.system')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
