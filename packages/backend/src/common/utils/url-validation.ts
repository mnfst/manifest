import { lookup } from 'dns/promises';

const PRIVATE_RANGES: { addr: bigint; mask: bigint }[] = [
  cidr('127.0.0.0', 8), // Loopback
  cidr('10.0.0.0', 8), // Class A private
  cidr('172.16.0.0', 12), // Class B private
  cidr('192.168.0.0', 16), // Class C private
  cidr('169.254.0.0', 16), // Link-local
  cidr('0.0.0.0', 8), // Current network
];

const PRIVATE_V6_PREFIXES = ['::1', 'fc00::', 'fd00::', 'fe80::'];

function cidr(base: string, prefix: number): { addr: bigint; mask: bigint } {
  const addr = ipv4ToBigInt(base);
  const mask = (BigInt('0xFFFFFFFF') << BigInt(32 - prefix)) & BigInt('0xFFFFFFFF');
  return { addr: addr & mask, mask };
}

function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split('.').map(Number);
  return (
    BigInt((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) & BigInt('0xFFFFFFFF')
  );
}

export function isPrivateIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6 addresses (::ffff:a.b.c.d)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const normalizedIp = mapped ? mapped[1] : ip;

  // Check IPv6 private ranges
  if (normalizedIp.includes(':')) {
    const lower = normalizedIp.toLowerCase();
    return PRIVATE_V6_PREFIXES.some((prefix) => lower.startsWith(prefix));
  }

  // Check IPv4 private ranges
  const parsed = normalizedIp.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!parsed) return false;

  const addr = ipv4ToBigInt(normalizedIp);
  return PRIVATE_RANGES.some((range) => (addr & range.mask) === range.addr);
}

export async function validatePublicUrl(url: string): Promise<void> {
  // Skip SSRF validation in test and local modes
  if (process.env['NODE_ENV'] === 'test' || process.env['MANIFEST_MODE'] === 'local') return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }

  // Reject IP literals directly in the URL
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isPrivateIp(hostname)) {
    throw new Error('URLs pointing to private or internal networks are not allowed');
  }

  // Resolve DNS and check all resolved IPs
  try {
    const result = await lookup(hostname, { all: true });
    const addresses = Array.isArray(result) ? result : [result];
    for (const entry of addresses) {
      if (isPrivateIp(entry.address)) {
        throw new Error('URLs pointing to private or internal networks are not allowed');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('private')) throw err;
    throw new Error(`Failed to resolve hostname: ${hostname}`);
  }
}
