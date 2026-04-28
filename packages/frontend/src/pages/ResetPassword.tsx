import { A, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { type Component, createSignal, createUniqueId, Show } from 'solid-js';
import { authClient } from '../services/auth-client.js';

const RequestResetForm: Component = () => {
  const [email, setEmail] = createSignal('');
  const [sent, setSent] = createSignal(false);
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const emailId = createUniqueId();
  const errorId = createUniqueId();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await authClient.requestPasswordReset({
      email: email(),
      redirectTo: '/reset-password',
    });

    setLoading(false);

    if (authError) {
      setError(authError.message ?? 'Failed to send reset email');
      return;
    }

    setSent(true);
  };

  return (
    <>
      <div class="auth-header">
        <h1 class="auth-header__title">Reset your password</h1>
        <p class="auth-header__subtitle">
          {sent()
            ? 'Check your email for a reset link'
            : 'Enter your email to receive a reset link'}
        </p>
      </div>

      <Show when={!sent()}>
        <form class="auth-form" onSubmit={handleSubmit}>
          {error() && (
            <div id={errorId} class="auth-form__error" role="alert">
              {error()}
            </div>
          )}
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
          <button class="auth-form__submit" type="submit" disabled={loading()}>
            {loading() ? <span class="spinner" /> : 'Send reset link'}
          </button>
        </form>
      </Show>

      <div class="auth-footer">
        <A href="/login" class="auth-footer__link">
          Back to sign in
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
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error: authError } = await authClient.resetPassword({
      newPassword: password(),
      token: props.token,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message ?? 'Failed to reset password');
      return;
    }

    setSuccess(true);
  };

  return (
    <>
      <div class="auth-header">
        <h1 class="auth-header__title">Set new password</h1>
        <p class="auth-header__subtitle">
          {success() ? 'Your password has been reset' : 'Enter your new password'}
        </p>
      </div>

      <Show
        when={!success()}
        fallback={
          <>
            <div class="auth-form">
              <div class="auth-form__success">
                Your password has been updated. You can now sign in with your new password.
              </div>
            </div>
            <div class="auth-footer">
              <A href="/login" class="auth-footer__link">
                Sign in
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
            New password
            <input
              id={passwordId}
              class="auth-form__input"
              type="password"
              autocomplete="new-password"
              placeholder="Enter new password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
              minLength={8}
              aria-describedby={error() ? errorId : undefined}
            />
          </label>
          <label class="auth-form__label" for={confirmId}>
            Confirm password
            <input
              id={confirmId}
              class="auth-form__input"
              type="password"
              autocomplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword()}
              onInput={(e) => setConfirmPassword(e.currentTarget.value)}
              required
              minLength={8}
              aria-describedby={error() ? errorId : undefined}
            />
          </label>
          <button class="auth-form__submit" type="submit" disabled={loading()}>
            {loading() ? <span class="spinner" /> : 'Reset password'}
          </button>
        </form>

        <div class="auth-footer">
          <A href="/login" class="auth-footer__link">
            Back to sign in
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
      <Title>Reset Password - Manifest</Title>
      <Meta name="description" content="Reset your Manifest account password." />
      <Show when={token()} fallback={<RequestResetForm />}>
        {(t) => <SetNewPasswordForm token={t()} />}
      </Show>
    </>
  );
};

export default ResetPassword;
