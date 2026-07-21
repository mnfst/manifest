import { A, useLocation, useNavigate, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import {
  type Component,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import SocialButtons from '../components/SocialButtons.jsx';
import PlanPicker, { type PlanId } from '../components/PlanPicker.jsx';
import { authClient } from '../services/auth-client.js';
import { appendSearch } from '../services/auth-redirects.js';
import { getLastAuthMethod, setLastAuthMethod } from '../services/last-auth-method.js';
import { checkSocialProviders } from '../services/setup-status.js';
import { getBillingStatus } from '../services/api/billing.js';
import { markPlanChosen } from '../services/plan-selection.js';
import { toast } from '../services/toast-store.js';
import { t, tr } from '../i18n/index.js';
import { authLocaleFetchOptions } from './auth-locale.js';
import type { BillingPrice } from 'manifest-shared';

const RESEND_COOLDOWN_SECONDS = 60;

const Register: Component = () => {
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [emailSent, setEmailSent] = createSignal(false);
  const [alreadyExists, setAlreadyExists] = createSignal(false);
  const [resendCooldown, setResendCooldown] = createSignal(0);
  const [socialProviders, setSocialProviders] = createSignal<string[]>([]);
  const [lastAuthMethod] = createSignal(getLastAuthMethod());
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [proPrice, setProPrice] = createSignal<BillingPrice | null>(null);
  const [planBusy, setPlanBusy] = createSignal(false);
  const location = useLocation();
  const session = authClient.useSession();
  const userId = () => session()?.data?.user?.id ?? '';
  const showPlan = () => searchParams.step === 'plan';
  const nameId = createUniqueId();
  const emailId = createUniqueId();
  const passwordId = createUniqueId();
  const errorId = createUniqueId();

  onMount(async () => {
    setSocialProviders(await checkSocialProviders());
  });

  createEffect(() => {
    if (!showPlan()) return;
    getBillingStatus({ cache: false })
      .then((status) => {
        if (status?.plan === 'pro') {
          markPlanChosen(userId());
          navigate('/', { replace: true });
        } else {
          setProPrice(status?.priceMonthly ?? null);
        }
      })
      .catch(() => {});
  });

  let cooldownInterval: ReturnType<typeof setInterval> | undefined;

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownInterval);
          cooldownInterval = undefined;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  onCleanup(() => {
    if (cooldownInterval) clearInterval(cooldownInterval);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await authClient.signUp.email(
      {
        name: name(),
        email: email(),
        password: password(),
        callbackURL: '/upgrade',
      },
      authLocaleFetchOptions(),
    );

    setLoading(false);

    if (authError) {
      if (authError.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
        setAlreadyExists(true);
      }
      setError(authError.message ?? t('pages.register.error.failed'));
      return;
    }
    setAlreadyExists(false);
    setLastAuthMethod('email');

    if (data?.token) {
      try {
        const status = await getBillingStatus();
        if (status?.enabled) {
          setProPrice(status.priceMonthly ?? null);
          window.location.href = '/register?step=plan';
          return;
        }
      } catch {
        /* billing unavailable — skip plan step */
      }
      window.location.href = '/';
      return;
    }

    setEmailSent(true);
    startCooldown();
  };

  const handlePlanSelect = async (plan: PlanId) => {
    if (plan === 'free') {
      markPlanChosen(userId());
      window.location.replace('/');
      return;
    }
    if (plan === 'enterprise') {
      return;
    }
    setPlanBusy(true);
    try {
      const origin = window.location.origin;
      const res = await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: `${origin}/overview?upgraded=1`,
        cancelUrl: `${origin}/register?step=plan`,
      });
      const error = (res as { error?: unknown } | undefined)?.error;
      if (error) throw error;
      markPlanChosen(userId());
    } catch {
      toast.error(t('pages.register.error.upgrade'));
      setPlanBusy(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown() > 0) return;

    const { error: resendError } = await authClient.sendVerificationEmail(
      {
        email: email(),
        callbackURL: '/upgrade',
      },
      authLocaleFetchOptions(),
    );

    if (resendError) {
      setError(resendError.message ?? t('pages.auth.error.resendVerification'));
      return;
    }

    startCooldown();
  };

  return (
    <>
      <Title>{t('pages.register.metaTitle')}</Title>
      <Meta name="description" content={t('pages.register.metaDescription')} />
      <Show
        when={!emailSent()}
        fallback={
          <>
            <div class="auth-header">
              <h1 class="auth-header__title">{t('pages.register.checkEmail')}</h1>
              <p class="auth-header__subtitle">
                {tr('pages.register.verificationSent', {
                  email: <strong>{email()}</strong>,
                })}
              </p>
            </div>

            <div class="auth-form">
              {error() && (
                <div class="auth-form__error" role="alert">
                  {error()}
                </div>
              )}
              <div class="auth-form__success">{t('pages.register.verificationInstructions')}</div>
              <button
                class="auth-form__link-btn"
                onClick={handleResend}
                disabled={resendCooldown() > 0}
              >
                {resendCooldown() > 0
                  ? t('pages.auth.resendIn', { count: resendCooldown() })
                  : t('pages.auth.resendVerification')}
              </button>
            </div>

            <div class="auth-footer">
              <A href={appendSearch('/login', location.search)} class="auth-footer__link">
                {t('pages.auth.backToSignIn')}
              </A>
            </div>
          </>
        }
      >
        <Show
          when={showPlan()}
          fallback={
            <>
              <div class="auth-header">
                <h1 class="auth-header__title">{t('pages.register.createTitle')}</h1>
                <p class="auth-header__subtitle">{t('pages.register.createSubtitle')}</p>
              </div>

              <SocialButtons enabledProviders={socialProviders()} lastUsed={lastAuthMethod()} />

              <Show when={socialProviders().length > 0}>
                <div class="auth-divider">
                  <span class="auth-divider__text">{t('pages.auth.or')}</span>
                </div>
              </Show>

              <form class="auth-form" onSubmit={handleSubmit}>
                <Show when={alreadyExists()}>
                  <div id={errorId} class="auth-form__error" role="alert">
                    {t('pages.register.accountExists')}{' '}
                    <A href={appendSearch('/login', location.search)} class="auth-form__error-link">
                      {t('pages.auth.signIn')}
                    </A>{' '}
                    {t('pages.auth.or')}{' '}
                    <A href="/reset-password" class="auth-form__error-link">
                      {t('pages.register.resetPassword')}
                    </A>
                    .
                  </div>
                </Show>
                <Show when={error() && !alreadyExists()}>
                  <div id={errorId} class="auth-form__error" role="alert">
                    {error()}
                  </div>
                </Show>
                <label class="auth-form__label" for={nameId}>
                  {t('pages.register.name')}
                  <input
                    ref={(el) => requestAnimationFrame(() => el.focus())}
                    id={nameId}
                    class="auth-form__input"
                    type="text"
                    autocomplete="name"
                    placeholder={t('pages.register.namePlaceholder')}
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                    required
                    aria-describedby={error() ? errorId : undefined}
                  />
                </label>
                <label class="auth-form__label" for={emailId}>
                  {t('pages.auth.email')}
                  <input
                    id={emailId}
                    class="auth-form__input"
                    type="email"
                    autocomplete="email"
                    placeholder={t('pages.auth.emailPlaceholder')}
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    required
                    aria-describedby={error() ? errorId : undefined}
                  />
                </label>
                <label class="auth-form__label" for={passwordId}>
                  {t('pages.auth.password')}
                  <input
                    id={passwordId}
                    class="auth-form__input"
                    type="password"
                    autocomplete="new-password"
                    placeholder={t('pages.register.passwordPlaceholder')}
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    required
                    minLength={8}
                    aria-describedby={error() ? errorId : undefined}
                  />
                </label>
                <button class="auth-form__submit" type="submit" disabled={loading()}>
                  {loading() ? <span class="spinner" /> : t('pages.register.createAccount')}
                </button>
              </form>
              <p class="auth-terms">
                {t('pages.register.termsPrefix')}{' '}
                <a
                  href="https://manifest.build/terms"
                  class="auth-terms__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('pages.register.terms')}
                </a>{' '}
                {t('pages.register.termsAnd')}{' '}
                <a
                  href="https://manifest.build/privacy"
                  class="auth-terms__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('pages.register.privacy')}
                </a>
              </p>
              <div class="auth-footer">
                <span>{t('pages.register.haveAccount')} </span>
                <A href={appendSearch('/login', location.search)} class="auth-footer__link">
                  {t('pages.auth.signIn')}
                </A>
              </div>
            </>
          }
        >
          <div class="auth-header">
            <h1 class="auth-header__title">
              {searchParams.context === 'login'
                ? t('pages.register.choosePlan')
                : t('pages.register.createTitle')}
            </h1>
            <p class="auth-header__subtitle">
              {searchParams.context === 'login'
                ? t('pages.register.planIntro')
                : t('pages.register.createSubtitle')}
            </p>
          </div>

          <Show when={searchParams.context !== 'login'}>
            <div class="plan-picker__section-header">
              <h2 class="plan-picker__section-title">{t('pages.register.choosePlan')}</h2>
              <p class="plan-picker__section-subtitle">{t('pages.register.planChange')}</p>
            </div>
          </Show>

          <PlanPicker proPrice={proPrice()} onSelect={handlePlanSelect} busy={planBusy()} />
        </Show>
      </Show>
    </>
  );
};

export default Register;
