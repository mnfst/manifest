import { Show, createSignal, type Component } from 'solid-js';

export const SOCIAL_FOLLOW_DISMISSED_KEY = 'manifest:overview-social-follow-dismissed:v4';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(SOCIAL_FOLLOW_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(SOCIAL_FOLLOW_DISMISSED_KEY, 'true');
  } catch {
    /* ignore */
  }
}

const SocialFollowBanner: Component = () => {
  const [dismissed, setDismissed] = createSignal(readDismissed());

  const dismiss = () => {
    setDismissed(true);
    writeDismissed();
  };

  return (
    <Show when={!dismissed()}>
      <aside class="overview-social-banner" aria-label="Manifest announcement">
        <div class="overview-social-banner__inner">
          <span class="overview-social-banner__text">
            🔥 Introducing request recovery and paid plans for Manifest Cloud.{' '}
            <a
              href="https://manifest.build/blog/introducing-paid-plans/"
              target="_blank"
              rel="noopener noreferrer"
              class="overview-social-banner__read-more"
            >
              Read more
            </a>
          </span>
          <button
            type="button"
            class="overview-social-banner__dismiss"
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

export default SocialFollowBanner;
