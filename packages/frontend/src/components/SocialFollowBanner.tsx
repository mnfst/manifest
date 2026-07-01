import { For, Show, createSignal, type Component } from 'solid-js';

export const SOCIAL_FOLLOW_DISMISSED_KEY = 'manifest:overview-social-follow-dismissed:v3';

const SOCIAL_LINKS = [
  {
    label: 'X',
    href: 'https://x.com/Manifestforai',
    icon: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2H21.8l-7.77 8.883L23.176 22h-7.159l-5.608-7.333L3.993 22H.435l8.31-9.497L0 2h7.34l5.07 6.701L18.244 2Zm-1.248 18.044h1.97L6.27 3.853H4.157l12.839 16.191Z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/manifest-for-agents/',
    icon: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.67H9.34V8.98h3.42v1.57h.05c.48-.9 1.64-1.85 3.37-1.85 3.61 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.41a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.04H3.53V8.98H7.1v11.47ZM22.23 0H1.76C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.76 24h20.47c.97 0 1.77-.77 1.77-1.73V1.73C24 .77 23.2 0 22.23 0Z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@Manifest-for-AI',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.51 3.58 12 3.58 12 3.58s-7.51 0-9.38.5A3 3 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.8a3 3 0 0 0 2.12 2.12c1.87.5 9.38.5 9.38.5s7.51 0 9.38-.5a3 3 0 0 0 2.12-2.12c.5-1.87.5-5.8.5-5.8s0-3.93-.5-5.8ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
      </svg>
    ),
  },
];

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
      <aside class="overview-social-banner" aria-label="Manifest community links">
        <div class="overview-social-banner__inner">
          <span class="overview-social-banner__text">
            Follow Manifest to stay informed about the latest models and available features
          </span>
          <div class="overview-social-banner__links">
            <For each={SOCIAL_LINKS}>
              {(link) => (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="overview-social-banner__link"
                  aria-label={`Manifest on ${link.label}`}
                  title={link.label}
                >
                  {link.icon()}
                </a>
              )}
            </For>
          </div>
          <button
            type="button"
            class="overview-social-banner__dismiss"
            aria-label="Dismiss social follow banner"
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
