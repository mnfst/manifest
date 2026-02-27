import { A, useSearchParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { type Component, createSignal, Show } from "solid-js";
import { authClient } from "../services/auth-client.js";

const RequestResetForm: Component = () => {
  const [email, setEmail] = createSignal("");
  const [sent, setSent] = createSignal(false);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await authClient.requestPasswordReset({
      email: email(),
      redirectTo: "/reset-password",
    });

    setLoading(false);

    if (authError) {
      setError(authError.message ?? "Failed to send reset email");
      return;
    }

    setSent(true);
  };

  return (
    <>
      <div class="auth-header">
        <h1 class="auth-header__title">Reset your password</h1>
        <p class="auth-header__subtitle">
          {sent() ? "Check your email for a reset link" : "Enter your email to receive a reset link"}
        </p>
      </div>

      <Show when={!sent()}>
        <form class="auth-form" onSubmit={handleSubmit}>
          {error() && <div class="auth-form__error">{error()}</div>}
          <label class="auth-form__label">
            Email
            <input
              class="auth-form__input"
              type="email"
              placeholder="you@example.com"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              required
            />
          </label>
          <button class="auth-form__submit" type="submit" disabled={loading()}>
            {loading() ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </Show>

      <div class="auth-footer">
        <A href="/login" class="auth-footer__link">Back to sign in</A>
      </div>
    </>
  );
};

const SetNewPasswordForm: Component<{ token: string }> = (props) => {
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [success, setSuccess] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (password() !== confirmPassword()) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const { error: authError } = await authClient.resetPassword({
      newPassword: password(),
      token: props.token,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message ?? "Failed to reset password");
      return;
    }

    setSuccess(true);
  };

  return (
    <>
      <div class="auth-header">
        <h1 class="auth-header__title">Set new password</h1>
        <p class="auth-header__subtitle">
          {success() ? "Your password has been reset" : "Enter your new password"}
        </p>
      </div>

      <Show when={!success()} fallback={
        <>
          <div class="auth-form">
            <div class="auth-form__success">
              Your password has been updated. You can now sign in with your new password.
            </div>
          </div>
          <div class="auth-footer">
            <A href="/login" class="auth-footer__link">Sign in</A>
          </div>
        </>
      }>
        <form class="auth-form" onSubmit={handleSubmit}>
          {error() && <div class="auth-form__error">{error()}</div>}
          <label class="auth-form__label">
            New password
            <input
              class="auth-form__input"
              type="password"
              placeholder="Enter new password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
              minLength={8}
            />
          </label>
          <label class="auth-form__label">
            Confirm password
            <input
              class="auth-form__input"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword()}
              onInput={(e) => setConfirmPassword(e.currentTarget.value)}
              required
              minLength={8}
            />
          </label>
          <button class="auth-form__submit" type="submit" disabled={loading()}>
            {loading() ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <div class="auth-footer">
          <A href="/login" class="auth-footer__link">Back to sign in</A>
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
