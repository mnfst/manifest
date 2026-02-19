import { A, useSearchParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { type Component, createSignal, onMount, Show } from "solid-js";
import SocialButtons from "../components/SocialButtons.jsx";
import { authClient } from "../services/auth-client.js";

const RESEND_COOLDOWN_SECONDS = 60;

const Login: Component = () => {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [needsVerification, setNeedsVerification] = createSignal(false);
  const [resendCooldown, setResendCooldown] = createSignal(0);
  const [searchParams] = useSearchParams();

  onMount(() => {
    if (searchParams.error) {
      setError("Login failed. Please try again or use a different method.");
    }
  });

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
    setNeedsVerification(false);
    setLoading(true);

    const { error: authError } = await authClient.signIn.email({
      email: email(),
      password: password(),
    })

    setLoading(false)

    if (authError) {
      const msg = authError.message ?? "";
      if (msg.toLowerCase().includes("email is not verified") || authError.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setError("Please verify your email before signing in.");
        return;
      }
      setError(msg || "Invalid email or password");
      return;
    }

    window.location.href = '/'
  }

  const handleResendVerification = async () => {
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
    setError("Verification email sent! Check your inbox.");
  };

  return (
    <>
      <Title>Sign In | Manifest</Title>
      <Meta name="description" content="Sign in to Manifest to monitor your AI agents." />
      <div class="auth-header">
        <h1 class="auth-header__title">Welcome back</h1>
        <p class="auth-header__subtitle">Track your agent activity and costs</p>
      </div>

      <SocialButtons />

      <div class="auth-divider">
        <span class="auth-divider__text">or</span>
      </div>

      <form class="auth-form" onSubmit={handleSubmit}>
        {error() && <div class="auth-form__error">{error()}</div>}
        <Show when={needsVerification()}>
          <button
            type="button"
            class="auth-form__link-btn"
            onClick={handleResendVerification}
            disabled={resendCooldown() > 0}
          >
            {resendCooldown() > 0
              ? `Resend in ${resendCooldown()}s`
              : "Resend verification email"}
          </button>
        </Show>
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
            placeholder="Enter your password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            required
          />
        </label>
        <div class="auth-form__actions">
          <A href="/reset-password" class="auth-form__forgot">
            Forgot password?
          </A>
        </div>
        <button class="auth-form__submit" type="submit" disabled={loading()}>
          {loading() ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <div class="auth-footer">
        <span>Don't have an account? </span>
        <A href="/register" class="auth-footer__link">
          Sign up
        </A>
      </div>
    </>
  )
}

export default Login
