import { createSignal, For, Show, onMount, onCleanup, type JSX } from 'solid-js';

// Bump this id when there's a new announcement worth re-surfacing to everyone.
// Keyed on a fixed announcement id (not the app version) so routine patch
// bumps don't re-trigger the same popup.
const ANNOUNCEMENT_ID = 'openai-sdk-models-v1';
const STORAGE_KEY = `manifest:whatsnew:${ANNOUNCEMENT_ID}`;

const HIGHLIGHTS = [
  'List OpenAI-compatible models with GET /v1/models.',
  'Use any returned model ID in the SDK model field to call that model directly.',
  'Keep model: auto when you want Manifest routing, params, and fallbacks.',
  'Direct SDK calls still appear in Messages and provider usage.',
] as const;

function hasSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // localStorage can throw in private mode / blocked storage — fail open
    // and just show the popup rather than crash.
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // ignore — worst case the user sees it again next load.
  }
}

export default function WhatsNewModal(): JSX.Element {
  const [open, setOpen] = createSignal(false);
  // Remember what had focus so we can hand it back when the modal closes.
  let previouslyFocused: HTMLElement | null = null;

  function dismiss() {
    markSeen();
    setOpen(false);
    previouslyFocused?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open()) dismiss();
  }

  onMount(() => {
    if (!hasSeen()) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      setOpen(true);
    }
    document.addEventListener('keydown', onKeyDown);
  });
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  return (
    <Show when={open()}>
      <div
        class="modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) dismiss();
        }}
      >
        <div
          class="modal whatsnew-modal"
          role="dialog"
          aria-modal="true"
          aria-label="What's new in Manifest"
        >
          <button
            class="modal__close whatsnew-modal__close"
            ref={(el) => requestAnimationFrame(() => el.focus())}
            onClick={dismiss}
            aria-label="Close"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div class="whatsnew-modal__body">
            <h2 class="whatsnew-modal__headline">What we just shipped</h2>
            <p class="whatsnew-modal__lead">
              OpenAI-compatible clients can now discover the models available through Manifest and
              opt into an exact provider/model pair when you want to skip routing.
            </p>
            <ul class="whatsnew-modal__list">
              <For each={HIGHLIGHTS as unknown as string[]}>
                {(item) => (
                  <li class="whatsnew-modal__item">
                    <svg
                      class="whatsnew-modal__check"
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{item}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>

          <div class="whatsnew-modal__footer">
            <p class="whatsnew-modal__help">
              Questions or a problem?{' '}
              <a
                href="https://github.com/mnfst/manifest/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open an issue
              </a>{' '}
              or{' '}
              <a
                href="https://discord.com/invite/FepAked3W7"
                target="_blank"
                rel="noopener noreferrer"
              >
                join our Discord
              </a>
              .
            </p>
            <button type="button" class="btn btn--primary" onClick={dismiss}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
