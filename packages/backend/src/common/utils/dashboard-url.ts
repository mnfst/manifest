/** Dashboard origin only; API and waitlist destinations are configured separately. */
export const DEFAULT_DASHBOARD_URL = 'https://gateway.manifest.build';

/** Emails need absolute URLs because they are read outside the dashboard. */
export function getDashboardBaseUrl(explicit?: string | null): string {
  const base = explicit || process.env['BETTER_AUTH_URL'] || DEFAULT_DASHBOARD_URL;
  return base.trim().replace(/\/+$/, '') || DEFAULT_DASHBOARD_URL;
}

export function getEmailAssetUrl(path: string, appUrl?: string | null): string {
  return `${getDashboardBaseUrl(appUrl)}/${path.replace(/^\/+/, '')}`;
}
