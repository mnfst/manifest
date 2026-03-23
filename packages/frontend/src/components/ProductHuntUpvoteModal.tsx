import { createEffect, createSignal, onCleanup, Show, type Component } from 'solid-js';
import { isLocalMode } from '../services/local-mode.js';

export const PRODUCT_HUNT_UPVOTE_KEY = 'mnfst_product_hunt_upvote_2026_03_23';
export const PRODUCT_HUNT_FALLBACK_URL = 'https://www.producthunt.com/search/posts?q=Manifest';

const PRODUCT_HUNT_URL =
  (import.meta.env.VITE_PRODUCT_HUNT_URL as string | undefined) ?? PRODUCT_HUNT_FALLBACK_URL;

const hasAcknowledgedPrompt = (): boolean => {
  try {
    return localStorage.getItem(PRODUCT_HUNT_UPVOTE_KEY) === '1';
  } catch {
    return false;
  }
};

const acknowledgePrompt = (): void => {
  try {
    localStorage.setItem(PRODUCT_HUNT_UPVOTE_KEY, '1');
  } catch {
    // Ignore storage failures and still close the modal for this session.
  }
};

const ProductHuntUpvoteModal: Component = () => {
  const [open, setOpen] = createSignal(false);

  const dismiss = () => {
    acknowledgePrompt();
    setOpen(false);
  };

  createEffect(() => {
    if (!isLocalMode() && !hasAcknowledgedPrompt()) {
      setOpen(true);
    }
  });

  createEffect(() => {
    if (!open()) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  return (
    <Show when={!isLocalMode() && open()}>
      <div
        class="modal-overlay product-hunt-modal__overlay"
        onClick={(event) => {
          if (event.target === event.currentTarget) dismiss();
        }}
      >
        <div
          class="modal-card product-hunt-modal__card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-hunt-upvote-title"
          aria-describedby="product-hunt-upvote-description"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            class="product-hunt-modal__close"
            type="button"
            onClick={dismiss}
            aria-label="Dismiss Product Hunt popup"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <div class="product-hunt-modal__eyebrow">
            <span class="product-hunt-modal__eyebrow-dot" aria-hidden="true" />
            Live on Product Hunt
          </div>

          <div class="product-hunt-modal__hero">
            <div class="product-hunt-modal__badge" aria-hidden="true">
              <span class="product-hunt-modal__badge-mark">P</span>
              <div class="product-hunt-modal__badge-copy">
                <span>Launch day</span>
                <strong>Support Manifest</strong>
              </div>
            </div>

            <div class="product-hunt-modal__copy">
              <h2 class="product-hunt-modal__title" id="product-hunt-upvote-title">
                Manifest is live on Product Hunt
              </h2>
              <p class="product-hunt-modal__description" id="product-hunt-upvote-description">
                If Manifest has helped you monitor agents, costs, or routing, a quick upvote would
                help more builders discover it while we launch.
              </p>
            </div>
          </div>

          <div class="product-hunt-modal__meta" aria-hidden="true">
            <span>10-second favor</span>
            <span>Builders supporting builders</span>
            <span>Shown once</span>
          </div>

          <div class="product-hunt-modal__actions">
            <a
              href={PRODUCT_HUNT_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="btn product-hunt-modal__primary"
              onClick={() => {
                acknowledgePrompt();
                setOpen(false);
              }}
            >
              Upvote on Product Hunt
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
            <button
              class="btn btn--ghost product-hunt-modal__secondary"
              type="button"
              onClick={dismiss}
            >
              Dismiss
            </button>
          </div>

          <p class="product-hunt-modal__footnote">
            Already upvoted? Close this and enjoy the dashboard.
          </p>
        </div>
      </div>
    </Show>
  );
};

export default ProductHuntUpvoteModal;
