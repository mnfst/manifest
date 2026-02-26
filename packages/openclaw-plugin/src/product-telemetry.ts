import { createHash } from "crypto";
import { hostname, platform, arch, release } from "os";
import { getTelemetryConfig } from "./telemetry-config";

const POSTHOG_HOST = "https://eu.i.posthog.com";
const POSTHOG_API_KEY = "phc_g5pLOu5bBRjhVJBwAsx0eCzJFWq0cri2TyVLQLxf045";

function getMachineId(): string {
  const raw = `${hostname()}-${platform()}-${arch()}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export function trackPluginEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  const config = getTelemetryConfig();
  if (config.optedOut) return;

  const payload = {
    api_key: POSTHOG_API_KEY,
    event,
    properties: {
      distinct_id: getMachineId(),
      os: platform(),
      os_version: release(),
      node_version: process.versions.node,
      package_version: config.packageVersion,
      mode: process.env['MANIFEST_MODE'] ?? 'local',
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
