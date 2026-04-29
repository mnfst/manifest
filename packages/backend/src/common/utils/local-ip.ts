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
