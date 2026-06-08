import type { Request } from 'express';
import {
  getSocketRemoteAddress,
  hasForwardedHeaders,
  isLoopbackIp,
  isLoopbackPeer,
  isTrustedLoopbackPeer,
} from './local-ip';

function makeRequest(
  peer: string | undefined,
  headers: Record<string, string | string[] | undefined> = {},
): Request {
  return {
    socket: peer === undefined ? {} : { remoteAddress: peer },
    headers,
  } as unknown as Request;
}

describe('local-ip', () => {
  describe('isLoopbackIp', () => {
    it('recognizes IPv4, IPv6 and IPv4-mapped loopback', () => {
      expect(isLoopbackIp('127.0.0.1')).toBe(true);
      expect(isLoopbackIp('::1')).toBe(true);
      expect(isLoopbackIp('::ffff:127.0.0.1')).toBe(true);
    });

    it('rejects non-loopback addresses', () => {
      expect(isLoopbackIp('8.8.8.8')).toBe(false);
      expect(isLoopbackIp('192.168.1.1')).toBe(false);
      expect(isLoopbackIp('')).toBe(false);
    });
  });

  describe('getSocketRemoteAddress', () => {
    it('returns the socket peer address', () => {
      expect(getSocketRemoteAddress(makeRequest('203.0.113.5'))).toBe('203.0.113.5');
    });

    it('returns undefined when the socket has no remote address', () => {
      expect(getSocketRemoteAddress(makeRequest(undefined))).toBeUndefined();
    });
  });

  describe('isLoopbackPeer', () => {
    it('is true for a loopback TCP peer', () => {
      expect(isLoopbackPeer(makeRequest('127.0.0.1'))).toBe(true);
      expect(isLoopbackPeer(makeRequest('::1'))).toBe(true);
    });

    it('is false for a remote peer or a missing peer', () => {
      expect(isLoopbackPeer(makeRequest('203.0.113.5'))).toBe(false);
      expect(isLoopbackPeer(makeRequest(undefined))).toBe(false);
    });
  });

  describe('hasForwardedHeaders', () => {
    it.each(['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip'])(
      'detects the %s header when set to a non-empty string',
      (header) => {
        expect(hasForwardedHeaders(makeRequest('127.0.0.1', { [header]: '1.2.3.4' }))).toBe(true);
      },
    );

    it('detects a forwarding header set to a non-empty array', () => {
      expect(
        hasForwardedHeaders(makeRequest('127.0.0.1', { 'x-forwarded-for': ['1.2.3.4'] })),
      ).toBe(true);
    });

    it('ignores empty string and empty array header values', () => {
      expect(hasForwardedHeaders(makeRequest('127.0.0.1', { 'x-forwarded-for': '' }))).toBe(false);
      expect(hasForwardedHeaders(makeRequest('127.0.0.1', { 'x-forwarded-for': [] }))).toBe(false);
    });

    it('is false when no forwarding headers are present', () => {
      expect(hasForwardedHeaders(makeRequest('127.0.0.1', { cookie: 'a=b' }))).toBe(false);
    });
  });

  describe('isTrustedLoopbackPeer', () => {
    it('trusts a direct loopback call with no forwarding headers', () => {
      expect(isTrustedLoopbackPeer(makeRequest('127.0.0.1'))).toBe(true);
    });

    it('does NOT trust a loopback peer that carries a forwarding header (reverse proxy)', () => {
      expect(
        isTrustedLoopbackPeer(makeRequest('127.0.0.1', { 'x-forwarded-for': '8.8.8.8' })),
      ).toBe(false);
    });

    it('does NOT trust a non-loopback peer', () => {
      expect(isTrustedLoopbackPeer(makeRequest('203.0.113.5'))).toBe(false);
    });
  });
});
