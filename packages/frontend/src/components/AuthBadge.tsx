import type { JSX } from 'solid-js';

const USER_ICON = (s: number) => (
  <svg
    width={s}
    height={s}
    viewBox="2 1 20 22"
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const KEY_ICON = (s: number) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

export function authLabel(authType: string | null | undefined): string {
  return authType === 'subscription' ? 'Subscription' : 'API Key';
}

export function authBadgeFor(
  authType: string | null | undefined,
  size: number,
): JSX.Element | null {
  const overlay = size <= 8 ? ' provider-auth-badge--overlay' : '';
  if (authType === 'subscription')
    return (
      <span
        class={`provider-auth-badge provider-auth-badge--sub${overlay}`}
        style={{ width: `${size}px`, height: `${size}px` }}
        aria-label="Subscription"
      >
        {USER_ICON(size * 0.58)}
      </span>
    );
  if (authType === 'api_key')
    return (
      <span
        class={`provider-auth-badge provider-auth-badge--key${overlay}`}
        style={{ width: `${size}px`, height: `${size}px` }}
        aria-label="API Key"
      >
        {KEY_ICON(size * 0.58)}
      </span>
    );
  return null;
}
