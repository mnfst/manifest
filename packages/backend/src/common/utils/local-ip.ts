import type { Request } from 'express';

export function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

/**
 * Returns the actual TCP peer address from the request socket.
 *
 * `request.ip` honors `trust proxy` and follows `X-Forwarded-For`, which is
 * spoofable when the server is reachable directly (no proxy in front, or a
 * proxy that fails to strip XFF). Auth bypasses gated on "is this loopback?"
 * must use the socket address — it cannot be forged by a remote attacker.
 */
export function getSocketRemoteAddress(request: Request): string | undefined {
  return request.socket?.remoteAddress ?? undefined;
}

export function isLoopbackPeer(request: Request): boolean {
  const peer = getSocketRemoteAddress(request);
  return !!peer && isLoopbackIp(peer);
}

// Headers that are only ever set by a reverse proxy / load balancer. A direct
// local caller (curl on the box, a local SDK, the bundled dashboard) sets none
// of them. The whole `x-forwarded-*` family is matched by prefix so a variant
// like `x-forwarded-port` can't slip a proxy hop past the check.
const PROXY_HEADER_PREFIX = 'x-forwarded-';
const PROXY_HEADER_NAMES = ['forwarded', 'x-real-ip', 'via'] as const;

/**
 * True when the request carries any header indicating it traversed a proxy hop.
 *
 * We deliberately key off the *presence* of these headers, never their values
 * (those are attacker-spoofable, and an empty value is still proof a proxy
 * inserted the header). Presence alone is enough to show the request did not
 * arrive as a direct local call. Node lowercases inbound header names, so the
 * comparison is case-insensitive.
 */
export function hasForwardedHeaders(request: Request): boolean {
  return Object.keys(request.headers).some(
    (name) =>
      name.startsWith(PROXY_HEADER_PREFIX) ||
      (PROXY_HEADER_NAMES as readonly string[]).includes(name),
  );
}

/**
 * The gate for loopback auth shortcuts: a request is treated as a trusted local
 * caller only when its TCP socket peer is loopback AND it shows no sign of a
 * proxy hop.
 *
 * A same-host reverse proxy (`proxy_pass http://127.0.0.1:PORT`) makes the
 * socket peer `127.0.0.1` for every forwarded request, so "peer is loopback"
 * on its own would extend the trusted-local shortcut to the entire internet.
 * Suppressing it whenever a forwarding header is present closes that gap while
 * still letting a genuine direct local call through.
 */
export function isTrustedLoopbackPeer(request: Request): boolean {
  return isLoopbackPeer(request) && !hasForwardedHeaders(request);
}
