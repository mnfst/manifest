import { Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { USER_DISCOVERY_BOOKING_URL } from './UserDiscoveryBanner.jsx';

export const USER_DISCOVERY_MODAL_DISMISSED_KEY =
  'manifest:user-discovery-modal-dismissed:v1';

export function readUserDiscoveryModalDismissed(): boolean {
  try {
    return (
      window.localStorage.getItem(USER_DISCOVERY_MODAL_DISMISSED_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

export function writeUserDiscoveryModalDismissed(): void {
  try {
    window.localStorage.setItem(USER_DISCOVERY_MODAL_DISMISSED_KEY, 'true');
  } catch {
    /* ignore */
  }
}

interface UserDiscoveryModalProps {
  open: boolean;
  onClose: () => void;
}

const benefits = [
  '15 minutes through a video call.',
  'Quick access to $25 of Gemini tokens through Manifest.',
  'You talk and we listen. Just questions and nothing to sell.',
];

const UserDiscoveryModal: Component<UserDiscoveryModalProps> = (props) => {
  const book = () => {
    window.open(USER_DISCOVERY_BOOKING_URL, '_blank', 'noopener,noreferrer');
    props.onClose();
  };

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="modal-backdrop"
          onClick={() => props.onClose()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') props.onClose();
          }}
        >
          <div
            class="modal user-discovery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-discovery-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="user-discovery-modal__banner">
              <img
                class="user-discovery-modal__banner-img"
                src="/images/discovery-banner.jpg"
                alt=""
                aria-hidden="true"
              />
              <button
                type="button"
                class="user-discovery-modal__close"
                aria-label="Close"
                onClick={() => props.onClose()}
              >
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div class="user-discovery-modal__body">
              <h2
                id="user-discovery-modal-title"
                class="user-discovery-modal__title"
              >
                Talk to us and get{' '}
                <mark class="user-discovery-modal__highlight">$25</mark> credit
                for{' '}
                <img
                  class="user-discovery-modal__title-logo"
                  src="/logos/gemini.svg"
                  alt="Gemini"
                />
                .
              </h2>
              <p class="user-discovery-modal__subtitle">
                We're doing user discovery to understand your expectations and
                pain points around agent reliability.
              </p>
              <ul class="user-discovery-modal__features">
                {benefits.map((f) => (
                  <li>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="#2632EF"
                      aria-hidden="true"
                    >
                      <path d="M9 15.59 4.71 11.3 3.3 12.71l5 5c.2.2.45.29.71.29s.51-.1.71-.29l11-11-1.41-1.41L9.02 15.59Z" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                class="btn btn--primary user-discovery-modal__cta"
                onClick={book}
              >
                Book my slot to get $25
              </button>
              <button
                type="button"
                class="user-discovery-modal__later"
                onClick={() => props.onClose()}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

export default UserDiscoveryModal;
