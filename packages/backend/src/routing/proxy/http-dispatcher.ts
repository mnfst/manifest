import { Agent, setGlobalDispatcher } from 'undici';

/**
 * Shared keep-alive HTTP dispatcher for all outbound provider traffic.
 *
 * Node's global `fetch` (undici) opens a fresh socket per request by default,
 * so every chat/completions forward pays a full DNS + TCP + TLS handshake. For
 * a proxy that fans the same agent's traffic at a handful of provider hosts,
 * that handshake tax dominates time-to-first-token. A process-wide keep-alive
 * `Agent` with a connection pool amortises it: sockets to a provider are
 * reused across requests for up to `keepAliveMaxTimeout`.
 *
 * This module is intentionally a small, pure, dependency-free unit — it only
 * builds an `Agent` and installs it as the global dispatcher. It does NOT
 * perform any request routing, header mutation, or URL validation.
 */

/** Parse a positive-integer env override, falling back to `fallback`. */
function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Default pool / keep-alive tuning. Each value is overridable via `UNDICI_*`. */
export const DISPATCHER_DEFAULTS = {
  /** Max simultaneous connections per origin in the pool. */
  connections: 128,
  /** Idle socket lifetime before undici closes it (ms). */
  keepAliveTimeout: 30_000,
  /** Hard cap on how long a socket may be reused even if kept warm (ms). */
  keepAliveMaxTimeout: 600_000,
  /** TCP/TLS connect timeout for opening a new socket (ms). */
  connectTimeout: 10_000,
} as const;

/**
 * Build the keep-alive `Agent`. Pool sizing and timeouts are read from the
 * `UNDICI_*` env vars on each call, defaulting to {@link DISPATCHER_DEFAULTS}.
 *
 * SECURITY — SSRF connect-time IP pinning seam:
 * App-layer SSRF validation runs BEFORE every `fetch` (see
 * `provider-client.ts` `validatePublicUrl` for `requiresSsrfRevalidation`
 * endpoints, plus `redirect: 'error'`). This global dispatcher only governs
 * socket pooling/reuse — it does NOT change the URL, host, scheme, or redirect
 * behaviour, so it cannot bypass those checks. The known open follow-up
 * (DNS-rebinding defence via connect-time IP pinning) belongs HERE: it would
 * wrap `connect` to re-validate the resolved IP at socket-open time. That work
 * is tracked separately and is deliberately NOT implemented in this change so
 * the security review can land it in isolation. Do not add IP pinning to the
 * app layer — add it to this `connect` seam when that task is picked up.
 */
export function buildDispatcher(): Agent {
  return new Agent({
    connections: envInt('UNDICI_CONNECTIONS', DISPATCHER_DEFAULTS.connections),
    keepAliveTimeout: envInt('UNDICI_KEEP_ALIVE_TIMEOUT_MS', DISPATCHER_DEFAULTS.keepAliveTimeout),
    keepAliveMaxTimeout: envInt(
      'UNDICI_KEEP_ALIVE_MAX_TIMEOUT_MS',
      DISPATCHER_DEFAULTS.keepAliveMaxTimeout,
    ),
    connect: {
      // This is the connect-time seam referenced above. Today it only sets the
      // socket connect timeout; a future SSRF task adds resolved-IP pinning by
      // wrapping the connector here.
      timeout: envInt('UNDICI_CONNECT_TIMEOUT_MS', DISPATCHER_DEFAULTS.connectTimeout),
    },
  });
}

/**
 * Install the keep-alive dispatcher as undici's process-wide default. Call once
 * at bootstrap, before the server starts accepting traffic. Returns the agent
 * so callers may inspect/close it (used in tests).
 */
export function installGlobalDispatcher(): Agent {
  const agent = buildDispatcher();
  setGlobalDispatcher(agent);
  return agent;
}
