import { Show, createSignal, createUniqueId, onCleanup, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  PIVOT_CANVAS_BG,
  PIVOT_CANVAS_INK,
  cssColor,
  initBlobCanvas,
} from '../services/blob-canvas.js';
import { authClient } from '../services/auth-client.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { useFocusTrap } from '../services/use-focus-trap.js';
import { hasPivotJoined, markPivotJoined, submitPivotClaim } from '../services/waitlist.js';

export const PIVOT_ARTICLE_URL = 'https://manifest.build/blog/introducing-paid-plans/';
const PIVOT_CARD_DISMISSED_KEY = 'pivot-card-dismissed';

/**
 * Bottom-of-sidebar announcement of the pivot. The card shows for everyone,
 * cloud and self-hosted alike, with a per-session dismiss. The modal joins
 * the waiting list with a prefilled but editable email: the guard rail for
 * self-hosted users who registered locally with a throwaway address.
 */
const PivotAnnouncement: Component = () => {
  const session = authClient.useSession();
  const userId = () => session()?.data?.user?.id ?? '';
  const sessionEmail = () => session()?.data?.user?.email ?? '';

  const [dismissed, setDismissed] = createSignal(
    sessionStorage.getItem(PIVOT_CARD_DISMISSED_KEY) === '1',
  );
  const dismiss = () => {
    sessionStorage.setItem(PIVOT_CARD_DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const [open, setOpen] = createSignal(false);
  const [email, setEmail] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [joined, setJoined] = createSignal(false);
  const emailId = createUniqueId();
  let dialogRef: HTMLDivElement | undefined;
  let closeBtnRef: HTMLButtonElement | undefined;
  useFocusTrap(open, () => dialogRef);

  const openModal = () => {
    setError('');
    setEmail(sessionEmail());
    setJoined(hasPivotJoined(userId()));
    setOpen(true);
  };
  const close = () => setOpen(false);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    if (busy()) return;
    setError('');
    setBusy(true);
    // Awaited here (module-cached after the first call) so a submit that
    // races the deployment-mode fetch can never target the wrong endpoint.
    const selfHosted = await checkIsSelfHosted();
    const ok = await submitPivotClaim(email().trim(), selfHosted);
    setBusy(false);
    if (!ok) {
      setError('Could not reach the waiting list. Please try again.');
      return;
    }
    markPivotJoined(userId());
    setJoined(true);
    // The submit button just left the DOM with the form: hand focus to the
    // Close button so keyboard and screen-reader users are not dropped.
    closeBtnRef?.focus();
  };

  return (
    <>
      <Show when={!dismissed()}>
        <div class="sidebar-pivot">
          {/* The inline background doubles as the fallback when the canvas
              cannot start; canvas colors are art data, not theme tokens. */}
          <div class="sidebar-pivot__top" style={{ background: cssColor(PIVOT_CANVAS_BG) }}>
            <canvas
              class="sidebar-pivot__canvas"
              aria-hidden="true"
              ref={(el) => {
                const stop = initBlobCanvas(el);
                onCleanup(stop);
              }}
            />
            <div class="sidebar-pivot__header">
              {/* Fine dark shadow (canvas art color) so the white title stays
                  readable on the light spots of the animated backdrop. */}
              <span
                class="sidebar-pivot__title"
                style={{ 'text-shadow': `0 0.5px 2px ${cssColor(PIVOT_CANVAS_INK, 0.45)}` }}
              >
                Manifest is becoming the self-healing layer for APIs
              </span>
              <button
                type="button"
                class="sidebar-pivot__dismiss"
                title="Hide for this session"
                aria-label="Hide the announcement for this session"
                onClick={dismiss}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z" />
                </svg>
              </button>
            </div>
          </div>
          <div class="sidebar-pivot__bottom">
            <p class="sidebar-pivot__desc">
              We're building a new product that fixes failed API requests on the fly.
            </p>
            <button type="button" class="sidebar-pivot__btn" onClick={openModal}>
              Learn more
            </button>
          </div>
        </div>
      </Show>

      <Portal>
        <Show when={open()}>
          <div
            class="modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') close();
            }}
          >
            <div
              ref={dialogRef}
              class="modal-card sidebar-pivot-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pivot-modal-title"
              aria-describedby="pivot-modal-description"
            >
              <div class="sidebar-pivot-modal__logo">
                <img
                  src="/logotype-white.svg"
                  alt="Manifest"
                  class="auth-logo__img auth-logo__img--light"
                />
                <img src="/logotype-dark.svg" alt="" class="auth-logo__img auth-logo__img--dark" />
              </div>
              <h2 class="modal-card__title" id="pivot-modal-title">
                Manifest is becoming the self-healing layer for APIs
              </h2>
              <p class="modal-card__desc" id="pivot-modal-description">
                We're building a new product that fixes failed API requests on the fly,
                independently of the gateway. The open-source gateway stays available and
                maintained.
              </p>
              <Show
                when={!joined()}
                fallback={
                  <p class="sidebar-pivot__joined" role="status">
                    <svg
                      width="16"
                      height="16"
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
                    You're on the list. We'll reach out at launch.
                  </p>
                }
              >
                <form onSubmit={handleSubmit}>
                  <Show when={error()}>
                    <div class="modal-card__field-error" role="alert">
                      {error()}
                    </div>
                  </Show>
                  <label class="modal-card__field-label" for={emailId}>
                    Email
                  </label>
                  <input
                    id={emailId}
                    class="modal-card__input"
                    type="email"
                    autocomplete="email"
                    placeholder="you@example.com"
                    value={email()}
                    onInput={(event) => setEmail(event.currentTarget.value)}
                    required
                  />
                  <p class="modal-card__field-hint">
                    Double-check the address: it's how we'll invite you.
                  </p>
                  <div class="modal-card__footer modal-card__footer--split">
                    <a
                      href={PIVOT_ARTICLE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="modal-card__field-link"
                    >
                      Read about the new direction →
                    </a>
                    <button type="submit" class="btn btn--primary btn--sm" disabled={busy()}>
                      {busy() ? <span class="spinner" /> : 'Join the waiting list'}
                    </button>
                  </div>
                </form>
              </Show>
              <Show when={joined()}>
                <div class="modal-card__footer modal-card__footer--split">
                  <a
                    href={PIVOT_ARTICLE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="modal-card__field-link"
                  >
                    Read about the new direction →
                  </a>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    class="btn btn--ghost btn--sm"
                    onClick={close}
                  >
                    Close
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </Portal>
    </>
  );
};

export default PivotAnnouncement;
