import { lookup } from 'dns/promises';
import { isIP } from 'net';

const PRIVATE_RANGES: { addr: bigint; mask: bigint }[] = [
  cidr('127.0.0.0', 8), // Loopback
  cidr('10.0.0.0', 8), // Class A private
  cidr('172.16.0.0', 12), // Class B private
  cidr('192.168.0.0', 16), // Class C private
  cidr('169.254.0.0', 16), // Link-local
  cidr('0.0.0.0', 8), // Current network
];

// ULA (fc00::/7) covers fc00::–fdff::, link-local is fe80::/10.
// We match by two-character hex prefix to avoid false negatives on
// addresses like fdc4:… that don't literally start with "fd00::".
const PRIVATE_V6_PREFIXES = ['::1', 'fc', 'fd', 'fe80::'];

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

export function isIpLiteral(host: string): boolean {
  return isIP(host) !== 0;
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

const CLOUD_METADATA_RANGES: { addr: bigint; mask: bigint }[] = [
  cidr('169.254.169.254', 32), // AWS/GCP/Azure metadata
  cidr('169.254.0.0', 16), // Link-local
];

const CLOUD_METADATA_V6 = ['fd00::', 'fe80::'];

export function isCloudMetadataIp(ip: string): boolean {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const normalizedIp = mapped ? mapped[1] : ip;

  if (normalizedIp.includes(':')) {
    const lower = normalizedIp.toLowerCase();
    return CLOUD_METADATA_V6.some((prefix) => lower.startsWith(prefix));
  }

  const parsed = normalizedIp.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!parsed) return false;

  const addr = ipv4ToBigInt(normalizedIp);
  return CLOUD_METADATA_RANGES.some((range) => (addr & range.mask) === range.addr);
}

export async function validatePublicUrl(
  url: string,
  opts: { allowPrivate?: boolean } = {},
): Promise<void> {
  // Skip SSRF validation in test mode (set SKIP_SSRF_VALIDATION=false to force validation)
  if (process.env['NODE_ENV'] === 'test' && process.env['SKIP_SSRF_VALIDATION'] !== 'false') return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  const allowPrivate = opts.allowPrivate === true;

  // Only http(s) schemes are acceptable. Everything else (ftp, file, gopher,
  // etc.) is rejected in both modes.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https URLs are allowed');
  }
  // HTTPS-only when we can't allow private destinations. Manifest forwards
  // API keys in Authorization headers and plaintext prompts/completions to
  // this URL; any non-TLS hop would expose them to passive wire-sniffing
  // (AC-2 in the Mine paper, arXiv:2604.08407). In self-hosted mode we allow
  // http:// for local destinations only — see the final check below.
  if (parsed.protocol === 'http:' && !allowPrivate) {
    throw new Error('Only https URLs are allowed');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  // Cloud-metadata endpoints are always blocked (even in self-hosted mode).
  if (isCloudMetadataIp(hostname)) {
    throw new Error('URLs pointing to cloud metadata endpoints are not allowed');
  }

  // Private IP literal in the URL itself
  if (isPrivateIp(hostname)) {
    if (!allowPrivate) {
      throw new Error('URLs pointing to private or internal networks are not allowed');
    }
    // allowPrivate + private literal: accept. No DNS resolution needed.
    return;
  }

  // Public IP literal: skip DNS, check http plaintext gate below.
  let addresses: { address: string }[];
  if (isIpLiteral(hostname)) {
    addresses = [{ address: hostname }];
  } else {
    try {
      const result = await lookup(hostname, { all: true });
      addresses = Array.isArray(result) ? result : [result];
    } catch {
      // Self-hosted deployments sometimes use hostnames that only resolve
      // inside the host's resolver (mDNS, /etc/hosts aliases, LAN-only
      // names). In allowPrivate mode we trust the operator and let the
      // subsequent fetch attempt decide — cloud metadata is still caught
      // on the resolved path when DNS succeeds, and a hostile public host
      // isn't reachable if DNS can't resolve it from inside the container.
      if (allowPrivate) return;
      throw new Error(`Failed to resolve hostname: ${hostname}`);
    }
  }

  let anyPublic = false;
  for (const { address } of addresses) {
    if (isCloudMetadataIp(address)) {
      throw new Error('URLs pointing to cloud metadata endpoints are not allowed');
    }
    if (isPrivateIp(address)) {
      if (!allowPrivate) {
        throw new Error('URLs pointing to private or internal networks are not allowed');
      }
    } else {
      anyPublic = true;
    }
  }

  // Defense in depth: refuse to send plaintext credentials to a public IP
  // via http even when allowPrivate is on (mixed-A-record attack).
  if (parsed.protocol === 'http:' && anyPublic) {
    throw new Error('http:// is only allowed for private hosts');
  }
}
