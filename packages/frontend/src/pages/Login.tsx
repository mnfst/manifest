import { A, useLocation, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { type Component, createSignal, createUniqueId, onCleanup, onMount, Show } from 'solid-js';
import SocialButtons from '../components/SocialButtons.jsx';
import { authClient } from '../services/auth-client.js';
import { appendSearch, getAuthDestination } from '../services/auth-redirects.js';
import { getLastAuthMethod, setLastAuthMethod } from '../services/last-auth-method.js';
import { checkSocialProviders } from '../services/setup-status.js';
import { t } from '../i18n/index.js';
import { authLocaleFetchOptions } from './auth-locale.js';

const RESEND_COOLDOWN_SECONDS = 60;

// Dev-only seed credentials (see packages/backend/src/database/database-seeder.service.ts,
// seeded only when SEED_DATA=true / non-production). Referenced solely inside the
// `import.meta.env.DEV` branch below, so Vite strips both the button and these literals
// from production builds — they never ship. The account exists only in a dev database.
const DEV_EMAIL = 'admin@manifest.build';
const DEV_PASSWORD = 'manifest';

const Login: Component = () => {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [needsVerification, setNeedsVerification] = createSignal(false);
  const [resendCooldown, setResendCooldown] = createSignal(0);
  const [socialProviders, setSocialProviders] = createSignal<string[]>([]);
  const [lastAuthMethod] = createSignal(getLastAuthMethod());
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const emailId = createUniqueId();
  const passwordId = createUniqueId();
  const errorId = createUniqueId();

  onMount(async () => {
    if (searchParams.error) {
      setError(t('pages.login.error.failed'));
    }
    setSocialProviders(await checkSocialProviders());
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
    setNeedsVerification(false);
    setLoading(true);

    const { error: authError } = await authClient.signIn.email({
      email: email(),
      password: password(),
    });

    setLoading(false);

    if (authError) {
      const msg = authError.message ?? '';
      if (
        msg.toLowerCase().includes('email is not verified') ||
        authError.code === 'EMAIL_NOT_VERIFIED'
      ) {
        setNeedsVerification(true);
        setError(t('pages.login.error.verifyEmail'));
        return;
      }
      setError(msg || t('pages.login.error.invalidCredentials'));
      return;
    }

    setLastAuthMethod('email');
    window.location.href = getAuthDestination(searchParams);
  };

  // Dev shortcut: fill + submit the seed admin. One click, no credentials in the URL;
  // compiled out of production (see DEV_EMAIL/DEV_PASSWORD).
  const signInAsDev = async () => {
    setEmail(DEV_EMAIL);
    setPassword(DEV_PASSWORD);
    setError('');
    setLoading(true);
    const { error: authError } = await authClient.signIn.email({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? t('pages.login.error.devFailed'));
      return;
    }
    setLastAuthMethod('email');
    window.location.href = '/';
  };

  const handleResendVerification = async () => {
    if (resendCooldown() > 0) return;

    const { error: resendError } = await authClient.sendVerificationEmail(
      {
        email: email(),
        callbackURL: getAuthDestination(searchParams),
      },
      authLocaleFetchOptions(),
    );

    if (resendError) {
      setError(resendError.message ?? t('pages.auth.error.resendVerification'));
      return;
    }

    startCooldown();
    setError(t('pages.login.verificationSent'));
  };

  return (
    <>
      <Title>{t('pages.login.metaTitle')}</Title>
      <Meta name="description" content={t('pages.login.metaDescription')} />
      <div class="auth-header">
        <h1 class="auth-header__title">{t('pages.login.title')}</h1>
        <p class="auth-header__subtitle">{t('pages.login.subtitle')}</p>
      </div>

      <SocialButtons enabledProviders={socialProviders()} lastUsed={lastAuthMethod()} />

      <Show when={socialProviders().length > 0}>
        <div class="auth-divider">
          <span class="auth-divider__text">{t('pages.auth.or')}</span>
        </div>
      </Show>

      <form class="auth-form" onSubmit={handleSubmit}>
        {import.meta.env.DEV && (
          <button
            type="button"
            class="auth-form__submit"
            onClick={signInAsDev}
            disabled={loading()}
            style="background:#f59e0b;color:#1f1400;font-weight:700;margin-bottom:0.75rem;"
          >
            {t('pages.login.devSignIn')}
          </button>
        )}
        {error() && (
          <div id={errorId} class="auth-form__error" role="alert">
            {error()}
          </div>
        )}
        <Show when={needsVerification()}>
          <button
            type="button"
            class="auth-form__link-btn"
            onClick={handleResendVerification}
            disabled={resendCooldown() > 0}
          >
            {resendCooldown() > 0
              ? t('pages.auth.resendIn', { count: resendCooldown() })
              : t('pages.auth.resendVerification')}
          </button>
        </Show>
        <label class="auth-form__label" for={emailId}>
          {t('pages.auth.email')}
          <input
            ref={(el) => requestAnimationFrame(() => el.focus())}
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
            autocomplete="current-password"
            placeholder={t('pages.login.passwordPlaceholder')}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            required
            aria-describedby={error() ? errorId : undefined}
          />
        </label>
        <div class="auth-form__actions">
          <A href="/reset-password" class="auth-form__forgot">
            {t('pages.login.forgotPassword')}
          </A>
        </div>
        <button class="auth-form__submit" type="submit" disabled={loading()}>
          {loading() ? <span class="spinner" /> : t('pages.auth.signIn')}
        </button>
      </form>
      <div class="auth-footer">
        <span>{t('pages.login.noAccount')} </span>
        <A href={appendSearch('/register', location.search)} class="auth-footer__link">
          {t('pages.login.signUp')}
        </A>
      </div>
    </>
  );
};

export default Login;
