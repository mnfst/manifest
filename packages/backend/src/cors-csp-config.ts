// Single source of truth for the dev-mode CORS allow-list and the CSP
// `frame-src` directive. The Wingman drawer is a dev-only affordance —
// the component is dead-code-eliminated from production bundles, so
// neither directive needs Wingman in production.

export const HOSTED_WINGMAN_ORIGIN = 'https://wingman.manifest.build';

export interface DevOriginBuilderOptions {
  configuredOrigin: string;
  wingmanPort: number;
}

export interface FrameSrcOptions {
  isDev: boolean;
  wingmanPort: number;
}

export function buildDevAllowedOrigins({
  configuredOrigin,
  wingmanPort,
}: DevOriginBuilderOptions): string[] {
  return Array.from(
    new Set([
      configuredOrigin,
      `http://localhost:${wingmanPort}`,
      `http://127.0.0.1:${wingmanPort}`,
      'http://localhost:3002',
      HOSTED_WINGMAN_ORIGIN,
    ]),
  );
}

export function buildFrameSrc({ isDev, wingmanPort }: FrameSrcOptions): string[] {
  if (!isDev) {
    return ["'self'"];
  }
  return [
    "'self'",
    `http://localhost:${wingmanPort}`,
    `http://127.0.0.1:${wingmanPort}`,
    HOSTED_WINGMAN_ORIGIN,
  ];
}

// Matches a well-formed CSP host-source: an http(s) origin with an optional
// `*.` subdomain wildcard, a host, and an optional port — no path, query, or
// fragment. Anything else (scheme-only `https:`, a raw CIDR like
// `192.168.1.0/24`, a bare `*`, junk) is rejected so a typo in FRAME_ANCESTORS
// can't weaken clickjacking protection or emit a malformed CSP token.
const FRAME_ANCESTOR_ORIGIN_RE = /^https?:\/\/(\*\.)?[a-zA-Z0-9.-]+(:\d+)?$/;

/**
 * Parse the operator-supplied `FRAME_ANCESTORS` env value into a validated CSP
 * `frame-ancestors` directive. Each comma-separated entry is kept only when it
 * is the `'self'` / `'none'` keyword or a well-formed http(s) origin; malformed
 * entries (and the wildcard `*`, which would allow any site to frame the app)
 * are dropped. Falls back to `'none'` when unset or when nothing valid remains,
 * so a fully-malformed value never silently disables framing protection.
 */
export function parseFrameAncestors(raw: string | undefined): string[] {
  if (!raw) return ["'none'"];
  const valid = raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v === "'self'" || v === "'none'" || FRAME_ANCESTOR_ORIGIN_RE.test(v));
  return valid.length > 0 ? valid : ["'none'"];
}

export type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;
export type CorsOriginHandler = (origin: string | undefined, callback: CorsOriginCallback) => void;

export function createCorsOriginHandler(allowedOrigins: string[]): CorsOriginHandler {
  return (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

// Chrome's Private Network Access blocks public HTTPS origins (e.g. the
// hosted Wingman SPA at https://wingman.manifest.build) from reaching
// loopback addresses unless the server echoes back
// `Access-Control-Allow-Private-Network: true` on the preflight. Only
// echo for origins that already passed the CORS allow-list so this
// header isn't a free pass for arbitrary callers.
//
// Shape kept narrow on purpose: takes only the request fields read and
// a setHeader callback so it composes with Express middleware and unit
// tests without dragging in `Request` / `Response` types.
export interface PnaRequest {
  method: string;
  headers: {
    origin?: string | string[];
    'access-control-request-private-network'?: string | string[];
  };
}

export function applyPrivateNetworkAllow(
  req: PnaRequest,
  allowedOrigins: string[],
  setHeader: (name: string, value: string) => void,
): void {
  if (req.method !== 'OPTIONS') return;
  const pnaHeader = req.headers['access-control-request-private-network'];
  if (pnaHeader !== 'true') return;
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !allowedOrigins.includes(origin)) return;
  setHeader('Access-Control-Allow-Private-Network', 'true');
}
