import { createEffect, createSignal, onCleanup, Show, type Component } from 'solid-js';
import productHuntFeaturedBadge from '../assets/product-hunt-featured.svg';
import { isLocalMode } from '../services/local-mode.js';

export const PRODUCT_HUNT_UPVOTE_KEY = 'mnfst_product_hunt_upvote_2026_03_23';
export const PRODUCT_HUNT_FALLBACK_URL =
  'https://www.producthunt.com/products/manifest-361?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-manifest-361';

const PRODUCT_HUNT_URL =
  (import.meta.env.VITE_PRODUCT_HUNT_URL as string | undefined) ?? PRODUCT_HUNT_FALLBACK_URL;
const PRODUCT_HUNT_ALT = 'Manifest - Open Source LLM Router for OpenClaw | Product Hunt';

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
    <Show when={open()}>
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

          <h2 class="product-hunt-modal__title" id="product-hunt-upvote-title">
            Manifest on Product Hunt
          </h2>
          <p class="product-hunt-modal__description">
            Manifest is open source and free to use. Support us with an upvote to help us
            improve the product and grow the community. Thank you 🙌
          </p>

          <a
            href={PRODUCT_HUNT_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="product-hunt-modal__featured-badge"
            onClick={() => {
              acknowledgePrompt();
              setOpen(false);
            }}
          >
            <div class="product-hunt-modal__featured-frame">
              <img
                src={productHuntFeaturedBadge}
                alt={PRODUCT_HUNT_ALT}
                width="250"
                height="54"
              />
            </div>
          </a>
        </div>
      </div>
    </Show>
  );
};

export default ProductHuntUpvoteModal;
