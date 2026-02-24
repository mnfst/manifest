import { createHash } from 'crypto';
import { hostname, platform, arch, release } from 'os';

jest.mock('./posthog-sender', () => ({
  sendToPostHog: jest.fn(),
}));

import { getMachineId, trackEvent, trackCloudEvent } from './product-telemetry';
import { sendToPostHog } from './posthog-sender';

const mockedSend = sendToPostHog as jest.Mock;

beforeEach(() => {
  mockedSend.mockClear();
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
  it('calls sendToPostHog with correct event and properties', () => {
    trackEvent('test_event');

    expect(mockedSend).toHaveBeenCalledTimes(1);
    const [event, props] = mockedSend.mock.calls[0];
    expect(event).toBe('test_event');
    expect(props.distinct_id).toMatch(/^[0-9a-f]{16}$/);
    expect(props.os).toBe(platform());
    expect(props.os_version).toBe(release());
    expect(props.node_version).toBe(process.versions.node);
    expect(props.mode).toBe('cloud');
  });

  it('merges custom properties', () => {
    trackEvent('test_event', { package_version: '5.2.4' });

    const props = mockedSend.mock.calls[0][1];
    expect(props.package_version).toBe('5.2.4');
  });

  it('does not send when MANIFEST_TELEMETRY_OPTOUT=1', () => {
    process.env['MANIFEST_TELEMETRY_OPTOUT'] = '1';
    trackEvent('test_event');
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('does not send when MANIFEST_TELEMETRY_OPTOUT=true', () => {
    process.env['MANIFEST_TELEMETRY_OPTOUT'] = 'true';
    trackEvent('test_event');
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('sends when not opted out', () => {
    trackEvent('test_event');
    expect(mockedSend).toHaveBeenCalledTimes(1);
  });

  it('uses MANIFEST_MODE env for mode property', () => {
    process.env['MANIFEST_MODE'] = 'local';
    trackEvent('test_event');

    const props = mockedSend.mock.calls[0][1];
    expect(props.mode).toBe('local');
  });
});

describe('trackCloudEvent', () => {
  it('uses hashed tenant ID as distinct_id', () => {
    trackCloudEvent('agent_created', 'tenant-123');

    const props = mockedSend.mock.calls[0][1];
    const expected = createHash('sha256')
      .update('tenant-123')
      .digest('hex')
      .slice(0, 16);
    expect(props.distinct_id).toBe(expected);
  });

  it('passes additional properties', () => {
    trackCloudEvent('agent_created', 'tenant-123', { extra: 'data' });

    const props = mockedSend.mock.calls[0][1];
    expect(props.extra).toBe('data');
  });

  it('respects opt-out', () => {
    process.env['MANIFEST_TELEMETRY_OPTOUT'] = '1';
    trackCloudEvent('agent_created', 'tenant-123');
    expect(mockedSend).not.toHaveBeenCalled();
  });
});
