import { telemetryOptOut } from "./local-mode.js";

const POSTHOG_HOST = "https://eu.i.posthog.com";
const POSTHOG_API_KEY = "phc_g5pLOu5bBRjhVJBwAsx0eCzJFWq0cri2TyVLQLxf045";
const ANON_ID_KEY = "mnfst_anon_id";

function getAnonymousId(): string {
  let id = localStorage.getItem(ANON_ID_KEY);
  if (id) return id;

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(ANON_ID_KEY, id);
  return id;
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (telemetryOptOut()) return;

  const payload = {
    api_key: POSTHOG_API_KEY,
    event,
    properties: {
      distinct_id: getAnonymousId(),
      source: "frontend",
      ...properties,
    },
    timestamp: new Date().toISOString(),
  };

  fetch(`${POSTHOG_HOST}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
