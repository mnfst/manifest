import { A } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { type Component, createSignal, createUniqueId, onCleanup, onMount, Show } from 'solid-js';
import SocialButtons from '../components/SocialButtons.jsx';
import { authClient } from '../services/auth-client.js';
import { checkSocialProviders } from '../services/setup-status.js';

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
  const nameId = createUniqueId();
  const emailId = createUniqueId();
  const passwordId = createUniqueId();
  const errorId = createUniqueId();

  onMount(async () => {
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
    setLoading(true);

    const { data, error: authError } = await authClient.signUp.email({
      name: name(),
      email: email(),
      password: password(),
    });

    setLoading(false);

    if (authError) {
      if (authError.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
        setAlreadyExists(true);
      }
      setError(authError.message ?? 'Registration failed');
      return;
    }
    setAlreadyExists(false);

    if (data?.token) {
      window.location.href = '/';
      return;
    }

    setEmailSent(true);
    startCooldown();
  };

  const handleResend = async () => {
    if (resendCooldown() > 0) return;

    const { error: resendError } = await authClient.sendVerificationEmail({
      email: email(),
      callbackURL: '/',
    });

    if (resendError) {
      setError(resendError.message ?? 'Failed to resend verification email');
      return;
    }

    startCooldown();
  };

  return (
    <>
      <Title>Sign Up - Manifest</Title>
      <Meta
        name="description"
        content="Create a Manifest account to start monitoring your AI agents."
      />
      <Show
        when={emailSent()}
        fallback={
          <>
            <div class="auth-header">
              <h1 class="auth-header__title">Create an account</h1>
              <p class="auth-header__subtitle">Monitor your AI agents' costs and usage</p>
            </div>

            <SocialButtons enabledProviders={socialProviders()} />

            <Show when={socialProviders().length > 0}>
              <div class="auth-divider">
                <span class="auth-divider__text">or</span>
              </div>
            </Show>

            <form class="auth-form" onSubmit={handleSubmit}>
              <Show when={alreadyExists()}>
                <div id={errorId} class="auth-form__error" role="alert">
                  An account with this email already exists.{' '}
                  <A href="/login" class="auth-form__error-link">
                    Sign in
                  </A>{' '}
                  or{' '}
                  <A href="/reset-password" class="auth-form__error-link">
                    reset your password
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
                Name
                <input
                  id={nameId}
                  class="auth-form__input"
                  type="text"
                  autocomplete="name"
                  placeholder="Your name"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  required
                  aria-describedby={error() ? errorId : undefined}
                />
              </label>
              <label class="auth-form__label" for={emailId}>
                Email
                <input
                  id={emailId}
                  class="auth-form__input"
                  type="email"
                  autocomplete="email"
                  placeholder="you@example.com"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  required
                  aria-describedby={error() ? errorId : undefined}
                />
              </label>
              <label class="auth-form__label" for={passwordId}>
                Password
                <input
                  id={passwordId}
                  class="auth-form__input"
                  type="password"
                  autocomplete="new-password"
                  placeholder="Create a password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  required
                  minLength={8}
                  aria-describedby={error() ? errorId : undefined}
                />
              </label>
              <button class="auth-form__submit" type="submit" disabled={loading()}>
                {loading() ? <span class="spinner" /> : 'Create account'}
              </button>
            </form>
            <p class="auth-terms">
              By signing up, you agree to our{' '}
              <a
                href="https://manifest.build/terms"
                class="auth-terms__link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms
              </a>{' '}
              and{' '}
              <a
                href="https://manifest.build/privacy"
                class="auth-terms__link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
            </p>
            <div class="auth-footer">
              <span>Already have an account? </span>
              <A href="/login" class="auth-footer__link">
                Sign in
              </A>
            </div>
          </>
        }
      >
        <div class="auth-header">
          <h1 class="auth-header__title">Check your email</h1>
          <p class="auth-header__subtitle">
            We sent a verification link to <strong>{email()}</strong>
          </p>
        </div>

        <div class="auth-form">
          {error() && (
            <div class="auth-form__error" role="alert">
              {error()}
            </div>
          )}
          <div class="auth-form__success">
            Click the link in your email to verify your account and get started.
          </div>
          <button
            class="auth-form__link-btn"
            onClick={handleResend}
            disabled={resendCooldown() > 0}
          >
            {resendCooldown() > 0 ? `Resend in ${resendCooldown()}s` : 'Resend verification email'}
          </button>
        </div>

        <div class="auth-footer">
          <A href="/login" class="auth-footer__link">
            Back to sign in
          </A>
        </div>
      </Show>
    </>
  );
};

export default Register;
