import { createHash } from "crypto";
import { hostname, platform, arch, release } from "os";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const POSTHOG_HOST = "https://eu.i.posthog.com";
const POSTHOG_API_KEY = "phc_g5pLOu5bBRjhVJBwAsx0eCzJFWq0cri2TyVLQLxf045";
const CONFIG_FILE = join(homedir(), ".openclaw", "manifest", "config.json");

function isOptedOut(): boolean {
  const envVal = process.env.MANIFEST_TELEMETRY_OPTOUT;
  if (envVal === "1" || envVal === "true") return true;

  try {
    if (existsSync(CONFIG_FILE)) {
      const config = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
      if (config.telemetryOptOut === true) return true;
    }
  } catch {
    // Ignore corrupted config
  }

  return false;
}

function getMachineId(): string {
  const raw = `${hostname()}-${platform()}-${arch()}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export function trackPluginEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (isOptedOut()) return;

  const payload = {
    api_key: POSTHOG_API_KEY,
    event,
    properties: {
      distinct_id: getMachineId(),
      os: platform(),
      os_version: release(),
      node_version: process.versions.node,
      package_version: process.env.PLUGIN_VERSION ?? "unknown",
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
