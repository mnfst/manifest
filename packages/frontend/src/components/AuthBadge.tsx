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

const LOCAL_ICON = (s: number) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m13.18 6.75 2.66-4.22-1.69-1.07L12 4.87 9.85 1.46 8.16 2.53l2.66 4.22-8.67 13.72A1.006 1.006 0 0 0 3 22.01h18c.36 0 .7-.2.88-.52s.16-.71-.03-1.02zM10.24 20 12 16.98 13.76 20zm5.83 0-3.21-5.5c-.36-.62-1.37-.62-1.73 0L7.92 20H4.81L12 8.62 19.19 20h-3.11Z" />
  </svg>
);

export function authLabel(authType: string | null | undefined): string {
  if (authType === 'subscription') return 'Subscription';
  if (authType === 'local') return 'Local';
  return 'API Key';
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
        role="img"
        aria-label="Subscription provider"
      >
        {USER_ICON(size * 0.58)}
      </span>
    );
  if (authType === 'api_key')
    return (
      <span
        class={`provider-auth-badge provider-auth-badge--key${overlay}`}
        style={{ width: `${size}px`, height: `${size}px` }}
        role="img"
        aria-label="API key provider"
      >
        {KEY_ICON(size * 0.58)}
      </span>
    );
  if (authType === 'local')
    return (
      <span
        class={`provider-auth-badge provider-auth-badge--local${overlay}`}
        style={{ width: `${size}px`, height: `${size}px` }}
        role="img"
        aria-label="Local provider"
      >
        {LOCAL_ICON(size * 0.7)}
      </span>
    );
  return null;
}
