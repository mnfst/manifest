export const MANIFEST_ERRORS_DOCS_BASE = 'https://manifest.build/docs/errors';

const PEACOCK = '🦚';

export const MANIFEST_ERRORS = {
  M001: {
    title: 'Missing Authorization header',
    template: 'Missing the Authorization header. Set it to "Bearer mnfst_<your-key>".',
  },
  M002: {
    title: 'Empty Bearer token',
    template: 'The Bearer token is empty. Paste your Manifest key into it.',
  },
  M003: {
    title: 'Invalid key format',
    template:
      'That doesn\'t look right. Manifest keys start with "mnfst_". Grab yours from the dashboard.',
  },
  M004: {
    title: 'Key expired',
    template: 'This key has expired. Generate a new one here',
  },
  M005: {
    title: 'Key not recognized',
    template:
      "I don't recognize this key. It might have been rotated or deleted. Grab the current one from the dashboard.",
  },
  M100: {
    title: 'Provider API key missing',
    template: 'No {provider} API key yet. Add one here: {dashboardUrl}',
  },
  M101: {
    title: 'No providers configured',
    template: "You're connected, but no providers are set up yet. Add one here: {dashboardUrl}",
  },
  M200: {
    title: 'Usage limit exceeded',
    template:
      'You hit your {metric} limit: {used} used, {threshold}/{period} allowed. Adjust it here: {dashboardUrl}',
  },
  M201: {
    title: 'Per-user rate limit exceeded',
    template: 'Too many requests — wait a few seconds and retry.',
  },
  M202: {
    title: 'Per-IP rate limit exceeded',
    template: 'Too many requests from this IP — wait a few seconds and retry.',
  },
  M203: {
    title: 'Concurrency limit exceeded',
    template: 'Too many concurrent requests. Give it a moment.',
  },
  M300: {
    title: 'Missing messages array',
    template: '`messages` array is required.',
  },
  M301: {
    title: 'Messages array too long',
    template: '`messages` array exceeds maximum length of {max}.',
  },
  M500: {
    title: 'Internal server error',
    template: 'Something broke on our end. Try again in a moment.',
  },
} as const;

export type ManifestErrorCode = keyof typeof MANIFEST_ERRORS;

export function formatManifestError(
  code: ManifestErrorCode,
  vars: Record<string, string | number> = {},
): string {
  const entry = MANIFEST_ERRORS[code];
  const interpolated = entry.template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
  return `[${PEACOCK} Manifest ${code}] ${interpolated} See ${MANIFEST_ERRORS_DOCS_BASE}/${code}`;
}
