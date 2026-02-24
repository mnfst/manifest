import { createHash } from 'crypto';
import { hostname, platform, arch, release } from 'os';
import { sendToPostHog } from './posthog-sender';

function isOptedOut(): boolean {
  const envVal = process.env['MANIFEST_TELEMETRY_OPTOUT'];
  return envVal === '1' || envVal === 'true';
}

export function getMachineId(): string {
  const raw = `${hostname()}-${platform()}-${arch()}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function getMode(): string {
  return process.env['MANIFEST_MODE'] ?? 'cloud';
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (isOptedOut()) return;
  sendToPostHog(event, {
    distinct_id: getMachineId(),
    os: platform(),
    os_version: release(),
    node_version: process.versions.node,
    mode: getMode(),
    ...properties,
  });
}

export function trackCloudEvent(
  event: string,
  tenantId: string,
  properties?: Record<string, unknown>,
): void {
  if (isOptedOut()) return;
  const hashedTenant = createHash('sha256').update(tenantId).digest('hex').slice(0, 16);
  sendToPostHog(event, {
    distinct_id: hashedTenant,
    os: platform(),
    os_version: release(),
    node_version: process.versions.node,
    mode: getMode(),
    ...properties,
  });
}
