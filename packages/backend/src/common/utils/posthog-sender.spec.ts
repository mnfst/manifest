import { sendToPostHog } from './posthog-sender';

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn().mockResolvedValue({});
  global.fetch = mockFetch;
});

describe('sendToPostHog', () => {
  it('sends a POST to PostHog /capture', () => {
    sendToPostHog('test_event', { distinct_id: 'abc123' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://eu.i.posthog.com/capture');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('includes api_key, event, properties, and timestamp', () => {
    sendToPostHog('my_event', { distinct_id: 'user-1', extra: 'data' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.api_key).toBe('phc_g5pLOu5bBRjhVJBwAsx0eCzJFWq0cri2TyVLQLxf045');
    expect(body.event).toBe('my_event');
    expect(body.properties.distinct_id).toBe('user-1');
    expect(body.properties.extra).toBe('data');
    expect(body.timestamp).toBeDefined();
  });

  it('silently ignores fetch errors', () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    expect(() => sendToPostHog('test_event', {})).not.toThrow();
  });
});
