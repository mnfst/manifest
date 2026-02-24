import { createHash } from 'crypto';
import { hostname, platform, arch } from 'os';
import { getMachineId, trackEvent, trackCloudEvent } from './product-telemetry';

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn().mockResolvedValue({});
  global.fetch = mockFetch;
  delete process.env['MANIFEST_TELEMETRY_OPTOUT'];
  delete process.env['MANIFEST_MODE'];
});

describe('getMachineId', () => {
  it('returns a 16-character hex string', () => {
    expect(getMachineId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable across calls', () => {
    expect(getMachineId()).toBe(getMachineId());
  });

  it('is derived from hostname, platform, and arch', () => {
    const expected = createHash('sha256')
      .update(`${hostname()}-${platform()}-${arch()}`)
      .digest('hex')
      .slice(0, 16);
    expect(getMachineId()).toBe(expected);
  });
});

describe('trackEvent', () => {
  it('sends a POST to PostHog /capture', () => {
    trackEvent('test_event');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://eu.i.posthog.com/capture');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('includes required properties in the payload', () => {
    trackEvent('test_event');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.event).toBe('test_event');
    expect(body.properties.distinct_id).toMatch(/^[0-9a-f]{16}$/);
    expect(body.properties.os).toBe(platform());
    expect(body.properties.node_version).toBe(process.versions.node);
    expect(body.properties.mode).toBe('cloud');
    expect(body.timestamp).toBeDefined();
  });

  it('merges custom properties', () => {
    trackEvent('test_event', { package_version: '5.2.4' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.properties.package_version).toBe('5.2.4');
  });

  it('does not send when MANIFEST_TELEMETRY_OPTOUT=1', () => {
    process.env['MANIFEST_TELEMETRY_OPTOUT'] = '1';
    trackEvent('test_event');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not send when MANIFEST_TELEMETRY_OPTOUT=true', () => {
    process.env['MANIFEST_TELEMETRY_OPTOUT'] = 'true';
    trackEvent('test_event');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends when not opted out', () => {
    trackEvent('test_event');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('uses MANIFEST_MODE env for mode property', () => {
    process.env['MANIFEST_MODE'] = 'local';
    trackEvent('test_event');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.properties.mode).toBe('local');
  });

  it('silently ignores fetch errors', () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    expect(() => trackEvent('test_event')).not.toThrow();
  });
});

describe('trackCloudEvent', () => {
  it('uses hashed tenant ID as distinct_id', () => {
    trackCloudEvent('agent_created', 'tenant-123');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const expected = createHash('sha256')
      .update('tenant-123')
      .digest('hex')
      .slice(0, 16);
    expect(body.properties.distinct_id).toBe(expected);
  });

  it('passes additional properties', () => {
    trackCloudEvent('agent_created', 'tenant-123', { extra: 'data' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.properties.extra).toBe('data');
  });

  it('respects opt-out', () => {
    process.env['MANIFEST_TELEMETRY_OPTOUT'] = '1';
    trackCloudEvent('agent_created', 'tenant-123');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
