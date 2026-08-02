import { useSearchParams } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { Show, createSignal, type Component } from 'solid-js';
import { fetchMutate } from '../services/api/core.js';

/** Mirrors the backend's `state` contract on POST /api/v1/cli/authorize. */
const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/;
/** The CLI listens on an ephemeral unprivileged loopback port. */
const PORT_RE = /^\d{1,5}$/;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

/**
 * Browser half of `mnfst login`: confirms the user wants to grant the CLI on
 * this machine a workspace token, then hands a one-time code to the CLI's
 * loopback listener. The explicit click is a security boundary — a drive-by
 * link must never silently mint a token.
 */
const CliAuth: Component = () => {
  const [params] = useSearchParams();
  const [phase, setPhase] = createSignal<'idle' | 'working' | 'done' | 'error'>('idle');
  const [error, setError] = createSignal('');

  const port = () => {
    const raw = String(params.port ?? '');
    if (!PORT_RE.test(raw)) return null;
    const parsed = Number(raw);
    return parsed >= MIN_PORT && parsed <= MAX_PORT ? parsed : null;
  };

  const state = () => {
    const raw = String(params.state ?? '');
    return STATE_RE.test(raw) ? raw : null;
  };

  const valid = () => port() !== null && state() !== null;

  const authorize = async () => {
    const requestState = state() as string;
    setPhase('working');
    try {
      const { code } = await fetchMutate<{ code: string }>('/cli/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: requestState }),
      });
      // Hand the one-time code back over loopback. The CLI exchanges it for the
      // token itself, so nothing long-lived ever rides in this URL.
      window.location.assign(
        `http://127.0.0.1:${port()}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(requestState)}`,
      );
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  };

  return (
    <div class="auth-layout">
      <Title>Authorize CLI - Manifest</Title>
      <div class="auth-card" style="text-align: center;">
        <div class="auth-logo">
          <img
            src="/logotype-white.svg"
            alt="Manifest"
            class="auth-logo__img auth-logo__img--light"
          />
          <img src="/logotype-dark.svg" alt="" class="auth-logo__img auth-logo__img--dark" />
        </div>
        <Show
          when={valid()}
          fallback={
            <div class="auth-header">
              <h1 class="auth-header__title">Invalid login request</h1>
              <p class="auth-header__subtitle">
                This link is missing or malformed. Return to your terminal and run{' '}
                <code>mnfst login</code> again.
              </p>
            </div>
          }
        >
          <Show when={phase() === 'idle' || phase() === 'working'}>
            <div class="auth-header">
              <h1 class="auth-header__title">Authorize the Manifest CLI?</h1>
              <p class="auth-header__subtitle">
                The CLI on this machine will get access to your workspace. You can revoke it any
                time from your account.
              </p>
            </div>
            {/* .auth-form is the column that stretches the submit button edge to
                edge, exactly as on the sign-in page. */}
            <div class="auth-form">
              <button
                class="auth-form__submit"
                type="button"
                onClick={authorize}
                disabled={phase() === 'working'}
              >
                {phase() === 'working' ? 'Authorizing...' : 'Authorize'}
              </button>
            </div>
          </Show>
          <Show when={phase() === 'done'}>
            <div class="auth-header">
              <h1 class="auth-header__title">Connected</h1>
              <p class="auth-header__subtitle">
                You can close this page and return to your terminal.
              </p>
            </div>
          </Show>
          <Show when={phase() === 'error'}>
            <div class="auth-header">
              <h1 class="auth-header__title">Authorization failed</h1>
            </div>
            <div class="auth-form__error" role="alert">
              {error()}
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default CliAuth;
