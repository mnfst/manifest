import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { CliIo } from './context';
import { configFilePath } from './config';
import { VERSION } from './version';

export const DEFAULT_TELEMETRY_ENDPOINT = 'https://telemetry.manifest.build/v1/cli-event';
const SEND_TIMEOUT_MS = 500;

/**
 * Anonymous usage telemetry, following the product's install-telemetry
 * doctrine: on by default, one event per command, opt-out via
 * MANIFEST_TELEMETRY_DISABLED=1. The payload is the registry command key
 * ("agent create" — NEVER arguments, URLs, agent names, or keys), the CLI
 * version, the platform, success/failure, and duration. The anon id is a
 * random UUID persisted next to the config; it identifies an install, not a
 * person or tenant.
 */
export function telemetryAnonId(io: CliIo): string {
  const idPath = path.join(path.dirname(configFilePath(io.env)), 'telemetry-id');
  try {
    const existing = fs.readFileSync(idPath, 'utf8').trim();
    if (/^[0-9a-f-]{36}$/.test(existing)) return existing;
  } catch {
    /* first run — mint below */
  }
  const fresh = randomUUID();
  try {
    fs.mkdirSync(path.dirname(idPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(idPath, fresh + '\n', { mode: 0o600 });
  } catch {
    /* unwritable config dir — still return a (per-process) id */
  }
  return fresh;
}

export function telemetryDisabled(io: CliIo): boolean {
  const v = io.env['MANIFEST_TELEMETRY_DISABLED'];
  return v === '1' || v === 'true';
}

/** Fire one usage event; every failure path is silent and time-capped. */
export async function reportUsage(
  io: CliIo,
  command: string,
  ok: boolean,
  durationMs: number,
): Promise<void> {
  if (telemetryDisabled(io)) return;
  const endpoint = io.env['MANIFEST_CLI_TELEMETRY_ENDPOINT'] ?? DEFAULT_TELEMETRY_ENDPOINT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await io.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema_version: 1,
        anon_id: telemetryAnonId(io),
        cli_version: VERSION,
        command,
        ok,
        duration_ms: Math.max(0, Math.min(600_000, Math.round(durationMs))),
        os: ['darwin', 'linux', 'win32'].includes(process.platform) ? process.platform : 'other',
      }),
      signal: controller.signal,
    });
    // Drain the body: an unread response keeps the socket alive and can delay
    // process exit past the command's own work — telemetry must be invisible.
    await (response.body?.cancel() ?? response.arrayBuffer());
  } catch {
    /* telemetry must never affect the command */
  } finally {
    clearTimeout(timer);
  }
}
