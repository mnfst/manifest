import { A, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { type Component, createSignal, createUniqueId, onMount, Show } from 'solid-js';
import { authClient } from '../services/auth-client.js';
import { checkEmailConfigured } from '../services/setup-status.js';
import { t } from '../i18n/index.js';
import { authLocaleFetchOptions } from './auth-locale.js';

const RequestResetForm: Component = () => {
  const [email, setEmail] = createSignal('');
  const [sent, setSent] = createSignal(false);
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  // Assume email works until the status check says otherwise, so the form
  // renders immediately and only flips to the notice on a confirmed no-provider
  // install (typically self-hosted without EMAIL_PROVIDER set).
  const [emailConfigured, setEmailConfigured] = createSignal(true);
  const emailId = createUniqueId();
  const errorId = createUniqueId();

  onMount(() => {
    void checkEmailConfigured().then(setEmailConfigured);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await authClient.requestPasswordReset(
      {
        email: email(),
        redirectTo: '/reset-password',
      },
      authLocaleFetchOptions(),
    );

    setLoading(false);

    if (authError) {
      setError(authError.message ?? t('pages.reset.error.send'));
      return;
    }

    setSent(true);
  };

  return (
    <>
      <div class="auth-header">
        <h1 class="auth-header__title">{t('pages.reset.title')}</h1>
        <p class="auth-header__subtitle">
          {!emailConfigured()
            ? t('pages.reset.emailUnavailable')
            : sent()
              ? t('pages.reset.checkEmail')
              : t('pages.reset.enterEmail')}
        </p>
      </div>

      <Show when={!emailConfigured()}>
        <div class="auth-form">
          <div class="auth-form__notice" role="status">
            {t('pages.reset.unavailableNotice')}{' '}
            <A href="/account" class="auth-form__notice-link">
              {t('pages.reset.account')}
            </A>{' '}
            {t('pages.reset.pageSuffix')}
          </div>
        </div>
      </Show>

      <Show when={emailConfigured() && !sent()}>
        <form class="auth-form" onSubmit={handleSubmit}>
          {error() && (
            <div id={errorId} class="auth-form__error" role="alert">
              {error()}
            </div>
          )}
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
          <button class="auth-form__submit" type="submit" disabled={loading()}>
            {loading() ? <span class="spinner" /> : t('pages.reset.sendLink')}
          </button>
        </form>
      </Show>

      <div class="auth-footer">
        <A href="/login" class="auth-footer__link">
          {t('pages.auth.backToSignIn')}
        </A>
      </div>
    </>
  );
};

const SetNewPasswordForm: Component<{ token: string }> = (props) => {
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);
  const passwordId = createUniqueId();
  const confirmId = createUniqueId();
  const errorId = createUniqueId();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (password() !== confirmPassword()) {
      setError(t('pages.reset.error.mismatch'));
      return;
    }

    setLoading(true);

    const { error: authError } = await authClient.resetPassword({
      newPassword: password(),
      token: props.token,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message ?? t('pages.reset.error.failed'));
      return;
    }

    setSuccess(true);
  };

  return (
    <>
      <div class="auth-header">
        <h1 class="auth-header__title">{t('pages.reset.newTitle')}</h1>
        <p class="auth-header__subtitle">
          {success() ? t('pages.reset.successSubtitle') : t('pages.reset.newSubtitle')}
        </p>
      </div>

      <Show
        when={!success()}
        fallback={
          <>
            <div class="auth-form">
              <div class="auth-form__success">{t('pages.reset.successMessage')}</div>
            </div>
            <div class="auth-footer">
              <A href="/login" class="auth-footer__link">
                {t('pages.auth.signIn')}
              </A>
            </div>
          </>
        }
      >
        <form class="auth-form" onSubmit={handleSubmit}>
          {error() && (
            <div id={errorId} class="auth-form__error" role="alert">
              {error()}
            </div>
          )}
          <label class="auth-form__label" for={passwordId}>
            {t('pages.reset.newPassword')}
            <input
              ref={(el) => requestAnimationFrame(() => el.focus())}
              id={passwordId}
              class="auth-form__input"
              type="password"
              autocomplete="new-password"
              placeholder={t('pages.reset.newPasswordPlaceholder')}
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
              minLength={8}
              aria-describedby={error() ? errorId : undefined}
            />
          </label>
          <label class="auth-form__label" for={confirmId}>
            {t('pages.reset.confirmPassword')}
            <input
              id={confirmId}
              class="auth-form__input"
              type="password"
              autocomplete="new-password"
              placeholder={t('pages.reset.confirmPasswordPlaceholder')}
              value={confirmPassword()}
              onInput={(e) => setConfirmPassword(e.currentTarget.value)}
              required
              minLength={8}
              aria-describedby={error() ? errorId : undefined}
            />
          </label>
          <button class="auth-form__submit" type="submit" disabled={loading()}>
            {loading() ? <span class="spinner" /> : t('pages.reset.submit')}
          </button>
        </form>

        <div class="auth-footer">
          <A href="/login" class="auth-footer__link">
            {t('pages.auth.backToSignIn')}
          </A>
        </div>
      </Show>
    </>
  );
};

const ResetPassword: Component = () => {
  const [searchParams] = useSearchParams();
  const token = () => searchParams.token as string | undefined;

  return (
    <>
      <Title>{t('pages.reset.metaTitle')}</Title>
      <Meta name="description" content={t('pages.reset.metaDescription')} />
      <Show when={token()} fallback={<RequestResetForm />}>
        {(t) => <SetNewPasswordForm token={t()} />}
      </Show>
    </>
  );
};

export default ResetPassword;
