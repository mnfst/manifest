import { isPrivateIp, isCloudMetadataIp, validatePublicUrl } from './url-validation';

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
  it('detects 169.254.169.254 as cloud metadata', () => {
    expect(isCloudMetadataIp('169.254.169.254')).toBe(true);
  });

  it('detects 169.254.0.1 as link-local (cloud metadata range)', () => {
    expect(isCloudMetadataIp('169.254.0.1')).toBe(true);
  });

  it('detects fd00::1 as cloud metadata IPv6', () => {
    expect(isCloudMetadataIp('fd00::1')).toBe(true);
  });

  it('detects fe80::1 as cloud metadata IPv6 link-local', () => {
    expect(isCloudMetadataIp('fe80::1')).toBe(true);
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

describe('validatePublicUrl', () => {
  const origNodeEnv = process.env['NODE_ENV'];
  const origManifestMode = process.env['MANIFEST_MODE'];

  beforeEach(() => {
    mockLookup.mockReset();
    // Force non-test mode for validation to run
    process.env['NODE_ENV'] = 'production';
    delete process.env['MANIFEST_MODE'];
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    if (origManifestMode) process.env['MANIFEST_MODE'] = origManifestMode;
    else delete process.env['MANIFEST_MODE'];
  });

  it('skips validation in test mode', async () => {
    process.env['NODE_ENV'] = 'test';
    await expect(validatePublicUrl('http://127.0.0.1:8080')).resolves.toBeUndefined();
  });

  it('allows private IPs in local mode', async () => {
    process.env['MANIFEST_MODE'] = 'local';
    await expect(validatePublicUrl('http://127.0.0.1:8080')).resolves.toBeUndefined();
  });

  it('blocks cloud metadata IPs in local mode', async () => {
    process.env['MANIFEST_MODE'] = 'local';
    await expect(validatePublicUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
      'cloud metadata',
    );
  });

  it('blocks hostnames resolving to metadata IPs in local mode', async () => {
    process.env['MANIFEST_MODE'] = 'local';
    mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never);
    await expect(validatePublicUrl('http://metadata.internal/latest')).rejects.toThrow(
      'cloud metadata',
    );
  });

  it('allows hostnames with DNS failure in local mode', async () => {
    process.env['MANIFEST_MODE'] = 'local';
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(validatePublicUrl('http://local-service:8080')).resolves.toBeUndefined();
  });

  it('accepts public URL that resolves to public IP', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    await expect(validatePublicUrl('https://example.com/api')).resolves.toBeUndefined();
  });

  it('rejects invalid URL format', async () => {
    await expect(validatePublicUrl('not-a-url')).rejects.toThrow('Invalid URL format');
  });

  it('rejects non-http/https schemes', async () => {
    await expect(validatePublicUrl('ftp://example.com')).rejects.toThrow(
      'Only http and https URLs are allowed',
    );
  });

  it('rejects file scheme', async () => {
    await expect(validatePublicUrl('file:///etc/passwd')).rejects.toThrow(
      'Only http and https URLs are allowed',
    );
  });

  it('rejects IP literal pointing to private network', async () => {
    await expect(validatePublicUrl('http://127.0.0.1:8080')).rejects.toThrow('private or internal');
  });

  it('rejects IP literal 10.x.x.x', async () => {
    await expect(validatePublicUrl('http://10.0.0.5/api')).rejects.toThrow('private or internal');
  });

  it('rejects IP literal 192.168.x.x', async () => {
    await expect(validatePublicUrl('http://192.168.1.100:3000')).rejects.toThrow(
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

  it('accepts http scheme', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    await expect(validatePublicUrl('http://example.com/api')).resolves.toBeUndefined();
  });
});
