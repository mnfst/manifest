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
// of them.
const FORWARDED_HEADER_NAMES = [
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
] as const;

/**
 * True when the request carries any header indicating it traversed a proxy hop.
 *
 * We deliberately trust only the *presence* of these headers, never their
 * values (those are attacker-spoofable). Presence alone is enough to prove the
 * request did not arrive as a direct local call.
 */
export function hasForwardedHeaders(request: Request): boolean {
  return FORWARDED_HEADER_NAMES.some((name) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.length > 0;
  });
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
