const POSTHOG_HOST = 'https://eu.i.posthog.com';
const POSTHOG_API_KEY = 'phc_g5pLOu5bBRjhVJBwAsx0eCzJFWq0cri2TyVLQLxf045';

export function sendToPostHog(event: string, properties: Record<string, unknown>): void {
  const payload = {
    api_key: POSTHOG_API_KEY,
    event,
    properties,
    timestamp: new Date().toISOString(),
  };

  fetch(`${POSTHOG_HOST}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
