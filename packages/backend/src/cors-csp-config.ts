// Single source of truth for the CORS allow-lists and the CSP `frame-src`
// directive. CORS allows the hosted Wingman gateway tester in both dev and
// production (it's a legitimate cross-origin caller of the gateway). The CSP
// `frame-src` — which governs embedding the Wingman drawer in the dashboard —
// stays dev-only, since that drawer is dead-code-eliminated from production.

export const HOSTED_WINGMAN_ORIGIN = 'https://wingman.manifest.build';

export interface DevOriginBuilderOptions {
  configuredOrigin: string;
  wingmanPort: number;
}

export interface ProdOriginBuilderOptions {
  /**
   * Comma-separated extra origins from `WINGMAN_CORS_ORIGINS` — lets an
   * operator whose self-hosted Wingman lives on a different origin than the
   * gateway opt it in without a code change.
   */
  extraOrigins?: string;
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

// Production CORS allow-list. The dashboard is same-origin, but the hosted
// Wingman gateway tester (https://wingman.manifest.build) is a legitimate
// cross-origin caller of the gateway routes (`/v1/chat/completions`,
// `/v1/messages`), so production must allow its origin. Exact match only, and
// `credentials: false` at the call site keeps this safe: an allow-listed origin
// still needs the user's own bearer key and no session cookie can ride along.
export function buildProdAllowedOrigins({ extraOrigins }: ProdOriginBuilderOptions = {}): string[] {
  const extras = (extraOrigins ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return Array.from(new Set([HOSTED_WINGMAN_ORIGIN, ...extras]));
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

// Preflight cache lifetime (seconds), shared by the dev and production CORS
// paths. Without a max-age the browser re-runs the preflight — including the
// dev Private Network Access preflight — roughly every 5s, so every dashboard
// reload (dev) or burst of Wingman requests (production) re-issues one. Each
// round trip is another chance for a transient blip to surface as a spurious
// CORS error. Caching the preflight collapses those repeats. 7200s (2h) is the
// ceiling Chrome honors.
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = 7200;

export interface CorsOptions {
  origin: CorsOriginHandler;
  credentials: false;
  maxAge: number;
}

// The exact `enableCors()` options main.ts uses (both dev and production —
// only the allow-list differs), kept here so the e2e/unit tests exercise the
// real shape rather than a hand-rolled copy. `credentials: false` is
// deliberate — Wingman uses bearer keys, never cookies, so keeping credentials
// off the cross-origin path means a misconfigured allow-list can't leak session
// cookies. `allowedHeaders` is intentionally omitted so the cors middleware
// reflects the request's `Access-Control-Request-Headers` (Wingman replays real
// SDK fingerprints like the `X-Stainless-*` family; a fixed allow-list would
// fail those preflights).
export function buildCorsOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin: createCorsOriginHandler(allowedOrigins),
    credentials: false,
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
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
