import { A } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { type Component, createSignal, Show } from "solid-js";
import SocialButtons from "../components/SocialButtons.jsx";
import { authClient } from "../services/auth-client.js";

const RESEND_COOLDOWN_SECONDS = 60;

const Register: Component = () => {
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [emailSent, setEmailSent] = createSignal(false);
  const [resendCooldown, setResendCooldown] = createSignal(0);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await authClient.signUp.email({
      name: name(),
      email: email(),
      password: password(),
    });

    setLoading(false);

    if (authError) {
      setError(authError.message ?? "Registration failed");
      return;
    }

    setEmailSent(true);
    startCooldown();
  };

  const handleResend = async () => {
    if (resendCooldown() > 0) return;

    const { error: resendError } = await authClient.sendVerificationEmail({
      email: email(),
      callbackURL: "/",
    });

    if (resendError) {
      setError(resendError.message ?? "Failed to resend verification email");
      return;
    }

    startCooldown();
  };

  return (
    <>
      <Title>Sign Up - Manifest</Title>
      <Meta name="description" content="Create a Manifest account to start monitoring your AI agents." />
      <Show when={emailSent()} fallback={
        <>
          <div class="auth-header">
            <h1 class="auth-header__title">Create an account</h1>
            <p class="auth-header__subtitle">Get started with Manifest</p>
          </div>

          <SocialButtons />

          <div class="auth-divider">
            <span class="auth-divider__text">or</span>
          </div>

          <form class="auth-form" onSubmit={handleSubmit}>
            {error() && <div class="auth-form__error">{error()}</div>}
            <label class="auth-form__label">
              Name
              <input
                class="auth-form__input"
                type="text"
                placeholder="Your name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                required
              />
            </label>
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
            <label class="auth-form__label">
              Password
              <input
                class="auth-form__input"
                type="password"
                placeholder="Create a password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                minLength={8}
              />
            </label>
            <button class="auth-form__submit" type="submit" disabled={loading()}>
              {loading() ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p class="auth-terms">
            By signing up, you agree to our{" "}
            <a href="#" class="auth-terms__link">Terms</a> and{" "}
            <a href="#" class="auth-terms__link">Privacy Policy</a>
          </p>
          <div class="auth-footer">
            <span>Already have an account? </span>
            <A href="/login" class="auth-footer__link">Sign in</A>
          </div>
        </>
      }>
        <div class="auth-header">
          <h1 class="auth-header__title">Check your email</h1>
          <p class="auth-header__subtitle">
            We sent a verification link to <strong>{email()}</strong>
          </p>
        </div>

        <div class="auth-form">
          {error() && <div class="auth-form__error">{error()}</div>}
          <div class="auth-form__success">
            Click the link in your email to verify your account and get started.
          </div>
          <button
            class="auth-form__link-btn"
            onClick={handleResend}
            disabled={resendCooldown() > 0}
          >
            {resendCooldown() > 0
              ? `Resend in ${resendCooldown()}s`
              : "Resend verification email"}
          </button>
        </div>

        <div class="auth-footer">
          <A href="/login" class="auth-footer__link">Back to sign in</A>
        </div>
      </Show>
    </>
  );
};

export default Register;
