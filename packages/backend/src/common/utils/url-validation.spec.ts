import { isPrivateIp, isCloudMetadataIp, isIpLiteral, validatePublicUrl } from './url-validation';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'dns/promises';

const mockLookup = lookup as jest.MockedFunction<typeof lookup>;

describe('isPrivateIp', () => {
  it('detects 127.0.0.1 as private', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
  });

  it('detects 127.255.255.255 as private', () => {
    expect(isPrivateIp('127.255.255.255')).toBe(true);
  });

  it('detects 10.0.0.1 as private', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
  });

  it('detects 172.16.0.1 as private', () => {
    expect(isPrivateIp('172.16.0.1')).toBe(true);
  });

  it('detects 172.31.255.255 as private', () => {
    expect(isPrivateIp('172.31.255.255')).toBe(true);
  });

  it('allows 172.32.0.1 (outside private range)', () => {
    expect(isPrivateIp('172.32.0.1')).toBe(false);
  });

  it('detects 192.168.1.1 as private', () => {
    expect(isPrivateIp('192.168.1.1')).toBe(true);
  });

  it('detects 169.254.0.1 as private (link-local)', () => {
    expect(isPrivateIp('169.254.0.1')).toBe(true);
  });

  it('detects 0.0.0.0 as private', () => {
    expect(isPrivateIp('0.0.0.0')).toBe(true);
  });

  it('allows 8.8.8.8 (public)', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('allows 1.2.3.4 (public)', () => {
    expect(isPrivateIp('1.2.3.4')).toBe(false);
  });

  it('detects ::1 as private IPv6', () => {
    expect(isPrivateIp('::1')).toBe(true);
  });

  it('detects fc00::1 as private IPv6', () => {
    expect(isPrivateIp('fc00::1')).toBe(true);
  });

  it('detects fd00::1 as private IPv6', () => {
    expect(isPrivateIp('fd00::1')).toBe(true);
  });

  it('detects fd12:3456:789a::1 as private IPv6 (ULA beyond the fd00:: literal prefix)', () => {
    expect(isPrivateIp('fd12:3456:789a::1')).toBe(true);
  });

  it('detects fe80::1 as private IPv6 (link-local)', () => {
    expect(isPrivateIp('fe80::1')).toBe(true);
  });

  it('detects ::ffff:127.0.0.1 as private (mapped IPv4)', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
  });

  it('detects ::ffff:10.0.0.1 as private (mapped IPv4)', () => {
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
  });

  it('allows ::ffff:8.8.8.8 (mapped public IPv4)', () => {
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('returns false for invalid IP format', () => {
    expect(isPrivateIp('not-an-ip')).toBe(false);
  });
});

describe('isCloudMetadataIp', () => {
  it('detects 169.254.169.254 as cloud metadata (AWS/GCP/Azure IMDS)', () => {
    expect(isCloudMetadataIp('169.254.169.254')).toBe(true);
  });

  it('detects 169.254.169.253 as cloud metadata (Alibaba/OCI IMDS)', () => {
    expect(isCloudMetadataIp('169.254.169.253')).toBe(true);
  });

  it('detects 100.100.100.200 as cloud metadata (Alibaba)', () => {
    expect(isCloudMetadataIp('100.100.100.200')).toBe(true);
  });

  it('does NOT flag generic link-local IPs (e.g. Podman host-gateway 169.254.1.2)', () => {
    expect(isCloudMetadataIp('169.254.1.2')).toBe(false);
    expect(isCloudMetadataIp('169.254.0.1')).toBe(false);
  });

  it('does NOT flag IPv6 ULA (fd00::/8) as metadata', () => {
    expect(isCloudMetadataIp('fd00::1')).toBe(false);
  });

  it('does NOT flag IPv6 link-local (fe80::/10) as metadata', () => {
    expect(isCloudMetadataIp('fe80::1')).toBe(false);
  });

  it('detects fd00:ec2::254 as IPv6 IMDS', () => {
    expect(isCloudMetadataIp('fd00:ec2::254')).toBe(true);
  });

  it('detects IPv4-mapped metadata IP', () => {
    expect(isCloudMetadataIp('::ffff:169.254.169.254')).toBe(true);
  });

  it('allows public IPs', () => {
    expect(isCloudMetadataIp('8.8.8.8')).toBe(false);
  });

  it('allows private IPs that are not metadata', () => {
    expect(isCloudMetadataIp('192.168.1.1')).toBe(false);
  });

  it('returns false for invalid format', () => {
    expect(isCloudMetadataIp('not-an-ip')).toBe(false);
  });

  it('allows public IPv6', () => {
    expect(isCloudMetadataIp('2001:db8::1')).toBe(false);
  });
});

describe('isIpLiteral', () => {
  it('recognises dotted-quad IPv4', () => {
    expect(isIpLiteral('127.0.0.1')).toBe(true);
    expect(isIpLiteral('8.8.8.8')).toBe(true);
  });

  it('recognises bracket-stripped IPv6', () => {
    expect(isIpLiteral('::1')).toBe(true);
    expect(isIpLiteral('fe80::1')).toBe(true);
  });

  it('rejects hostnames with : but non-hex characters', () => {
    // Defensive branch: URL parsing rejects these before they reach
    // validatePublicUrl, but the helper must still return false.
    expect(isIpLiteral('host:with-letters')).toBe(false);
    expect(isIpLiteral('zzz::1')).toBe(false);
  });

  it('rejects plain hostnames with no : or dotted-quad', () => {
    expect(isIpLiteral('example.com')).toBe(false);
  });
});

describe('validatePublicUrl', () => {
  const origNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    mockLookup.mockReset();
    // Force non-test mode for validation to run
    process.env['NODE_ENV'] = 'production';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
  });

  it('skips validation in test mode', async () => {
    process.env['NODE_ENV'] = 'test';
    await expect(validatePublicUrl('https://127.0.0.1:8080')).resolves.toBeUndefined();
  });

  it('enforces validation in test mode when SKIP_SSRF_VALIDATION=false', async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SKIP_SSRF_VALIDATION'] = 'false';
    try {
      await expect(validatePublicUrl('https://127.0.0.1:8080')).rejects.toThrow(
        'private or internal',
      );
    } finally {
      delete process.env['SKIP_SSRF_VALIDATION'];
    }
  });

  it('accepts public URL that resolves to public IP', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    await expect(validatePublicUrl('https://example.com/api')).resolves.toBeUndefined();
  });

  it('rejects invalid URL format', async () => {
    await expect(validatePublicUrl('not-a-url')).rejects.toThrow('Invalid URL format');
  });

  it('rejects non-http(s) schemes', async () => {
    await expect(validatePublicUrl('ftp://example.com')).rejects.toThrow(
      'Only http and https URLs are allowed',
    );
  });

  it('rejects file scheme', async () => {
    await expect(validatePublicUrl('file:///etc/passwd')).rejects.toThrow(
      'Only http and https URLs are allowed',
    );
  });

  it('rejects ftp scheme even when allowPrivate=true', async () => {
    await expect(validatePublicUrl('ftp://example.com', { allowPrivate: true })).rejects.toThrow(
      'Only http and https URLs are allowed',
    );
  });

  it('rejects plaintext http scheme (AC-2 passive exfiltration)', async () => {
    await expect(validatePublicUrl('http://example.com/api')).rejects.toThrow(
      /Only https URLs are allowed in cloud mode/,
    );
  });

  it('hints at MANIFEST_MODE=selfhosted when http is rejected (issue #1780)', async () => {
    await expect(validatePublicUrl('http://llamacpp:8080/v1')).rejects.toThrow(
      /MANIFEST_MODE=selfhosted/,
    );
  });

  it('rejects IP literal pointing to private network', async () => {
    await expect(validatePublicUrl('https://127.0.0.1:8080')).rejects.toThrow(
      'private or internal',
    );
  });

  it('rejects IP literal 10.x.x.x', async () => {
    await expect(validatePublicUrl('https://10.0.0.5/api')).rejects.toThrow('private or internal');
  });

  it('rejects IP literal 192.168.x.x', async () => {
    await expect(validatePublicUrl('https://192.168.1.100:3000')).rejects.toThrow(
      'private or internal',
    );
  });

  it('rejects hostname that resolves to private IP', async () => {
    mockLookup.mockResolvedValue([{ address: '192.168.1.1', family: 4 }] as never);
    await expect(validatePublicUrl('https://evil.example.com')).rejects.toThrow(
      'private or internal',
    );
  });

  it('rejects hostname that resolves to loopback', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    await expect(validatePublicUrl('https://localhost.example.com')).rejects.toThrow(
      'private or internal',
    );
  });

  it('rejects when any resolved IP is private', async () => {
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ] as never);
    await expect(validatePublicUrl('https://dual.example.com')).rejects.toThrow(
      'private or internal',
    );
  });

  it('rejects when DNS resolution fails', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(validatePublicUrl('https://nonexistent.invalid')).rejects.toThrow(
      'Failed to resolve hostname',
    );
  });

  it('accepts https scheme', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    await expect(validatePublicUrl('https://example.com/api')).resolves.toBeUndefined();
  });

  it('handles non-array lookup result (single object)', async () => {
    mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 } as never);
    await expect(validatePublicUrl('https://single.example.com')).resolves.toBeUndefined();
  });

  describe('with allowPrivate=true (self-hosted)', () => {
    it('accepts https loopback literal', async () => {
      await expect(
        validatePublicUrl('https://127.0.0.1:11434', { allowPrivate: true }),
      ).resolves.toBeUndefined();
    });

    it('accepts http loopback literal', async () => {
      await expect(
        validatePublicUrl('http://127.0.0.1:11434', { allowPrivate: true }),
      ).resolves.toBeUndefined();
    });

    it('accepts http 192.168.x.x literal', async () => {
      await expect(
        validatePublicUrl('http://192.168.1.50:8080/v1', { allowPrivate: true }),
      ).resolves.toBeUndefined();
    });

    it('accepts hostname that resolves to a private IP', async () => {
      mockLookup.mockResolvedValue([{ address: '172.17.0.1', family: 4 }] as never);
      await expect(
        validatePublicUrl('http://host.docker.internal:11434', { allowPrivate: true }),
      ).resolves.toBeUndefined();
    });

    it('still blocks cloud metadata IP literal', async () => {
      await expect(
        validatePublicUrl('https://169.254.169.254', { allowPrivate: true }),
      ).rejects.toThrow('cloud metadata endpoints');
    });

    it('still blocks hostname that resolves to a cloud metadata IP', async () => {
      mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never);
      await expect(
        validatePublicUrl('https://evil.example.com', { allowPrivate: true }),
      ).rejects.toThrow('cloud metadata endpoints');
    });

    it('rejects http:// to a public IP (plaintext exfil protection)', async () => {
      await expect(validatePublicUrl('http://8.8.8.8', { allowPrivate: true })).rejects.toThrow(
        'http:// is only allowed for private hosts',
      );
    });

    it('rejects http:// when hostname resolves to mixed public+private A records', async () => {
      mockLookup.mockResolvedValue([
        { address: '10.0.0.1', family: 4 },
        { address: '93.184.216.34', family: 4 },
      ] as never);
      await expect(
        validatePublicUrl('http://mixed.example.com', { allowPrivate: true }),
      ).rejects.toThrow('http:// is only allowed for private hosts');
    });

    it('accepts https:// to a public IP', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
      await expect(
        validatePublicUrl('https://example.com/api', { allowPrivate: true }),
      ).resolves.toBeUndefined();
    });

    it('treats unresolvable hostnames as non-fatal (LAN-only names, mDNS)', async () => {
      mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
      await expect(
        validatePublicUrl('http://my-lan-box.local/v1', { allowPrivate: true }),
      ).resolves.toBeUndefined();
    });
  });
});
