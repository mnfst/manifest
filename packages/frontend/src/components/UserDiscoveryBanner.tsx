import { Show, createSignal, type Component } from 'solid-js';

export const USER_DISCOVERY_BANNER_DISMISSED_KEY =
  'manifest:user-discovery-banner-dismissed:v1';

export const USER_DISCOVERY_BOOKING_URL =
  'https://calendly.com/sebastien-manifest/15min';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(USER_DISCOVERY_BANNER_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(USER_DISCOVERY_BANNER_DISMISSED_KEY, 'true');
  } catch {
    /* ignore */
  }
}

const UserDiscoveryBanner: Component = () => {
  const [dismissed, setDismissed] = createSignal(readDismissed());

  const dismiss = () => {
    setDismissed(true);
    writeDismissed();
  };

  return (
    <Show when={!dismissed()}>
      <aside class="overview-discovery-banner" aria-label="Manifest user research">
        <div class="overview-discovery-banner__inner">
          <span class="overview-discovery-banner__text">
            🎁 Talk to us and get $25 of Gemini credit{' '}
            <a
              href={USER_DISCOVERY_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="overview-discovery-banner__cta"
            >
              Book a slot →
            </a>
          </span>
          <button
            type="button"
            class="overview-discovery-banner__dismiss"
            aria-label="Dismiss banner"
            onClick={dismiss}
          >
            <svg
              width="15"
              height="15"
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
      </aside>
    </Show>
  );
};

export default UserDiscoveryBanner;
