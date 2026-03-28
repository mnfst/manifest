import { isLoopbackIp, isAllowedLocalIp } from './local-ip';

describe('isLoopbackIp', () => {
  it.each([
    ['127.0.0.1', true],
    ['::1', true],
    ['::ffff:127.0.0.1', true],
    ['10.0.0.1', false],
    ['192.168.1.1', false],
    ['172.16.0.1', false],
    ['8.8.8.8', false],
    ['', false],
  ])('isLoopbackIp(%s) → %s', (ip, expected) => {
    expect(isLoopbackIp(ip)).toBe(expected);
  });
});

describe('isAllowedLocalIp (default — loopback only)', () => {
  const origTrustLan = process.env['MANIFEST_TRUST_LAN'];

  beforeEach(() => {
    delete process.env['MANIFEST_TRUST_LAN'];
  });

  afterEach(() => {
    if (origTrustLan === undefined) delete process.env['MANIFEST_TRUST_LAN'];
    else process.env['MANIFEST_TRUST_LAN'] = origTrustLan;
  });

  it.each([
    ['127.0.0.1', true],
    ['::1', true],
    ['::ffff:127.0.0.1', true],
    // Private IPs rejected by default
    ['10.0.0.1', false],
    ['192.168.1.100', false],
    ['172.16.0.1', false],
    ['::ffff:192.168.1.50', false],
    // Public IPs
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['', false],
  ])('isAllowedLocalIp(%s) → %s', (ip, expected) => {
    expect(isAllowedLocalIp(ip)).toBe(expected);
  });
});

describe('isAllowedLocalIp (MANIFEST_TRUST_LAN=true)', () => {
  const origTrustLan = process.env['MANIFEST_TRUST_LAN'];

  beforeEach(() => {
    process.env['MANIFEST_TRUST_LAN'] = 'true';
  });

  afterEach(() => {
    if (origTrustLan === undefined) delete process.env['MANIFEST_TRUST_LAN'];
    else process.env['MANIFEST_TRUST_LAN'] = origTrustLan;
  });

  it.each([
    // Loopback
    ['127.0.0.1', true],
    ['::1', true],
    ['::ffff:127.0.0.1', true],
    // 10.0.0.0/8
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    // 172.16.0.0/12
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['172.15.0.1', false],
    ['172.32.0.1', false],
    // 192.168.0.0/16
    ['192.168.0.1', true],
    ['192.168.1.100', true],
    ['192.168.255.255', true],
    // IPv4-mapped IPv6 private
    ['::ffff:192.168.1.50', true],
    ['::ffff:10.0.0.1', true],
    // Public IPs
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['203.0.113.1', false],
    // Edge cases
    ['', false],
  ])('isAllowedLocalIp(%s) → %s', (ip, expected) => {
    expect(isAllowedLocalIp(ip)).toBe(expected);
  });
});
