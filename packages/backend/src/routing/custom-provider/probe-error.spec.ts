import { classifyProbeError } from './probe-error';

describe('classifyProbeError', () => {
  const url = 'http://host.docker.internal:8000/v1/models';

  it('classifies ECONNREFUSED as connection_refused with a start-the-server hint', () => {
    const out = classifyProbeError({
      url,
      error: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8000'), {
        code: 'ECONNREFUSED',
      }),
    });
    expect(out.kind).toBe('connection_refused');
    expect(out.message).toMatch(/No server is listening/);
  });

  it('falls through to connection_refused via message substring', () => {
    const out = classifyProbeError({
      url,
      error: new Error('fetch failed: ECONNREFUSED'),
    });
    expect(out.kind).toBe('connection_refused');
  });

  it('unwraps Node fetch errors where the real cause is on error.cause', () => {
    // This is what `fetch()` actually throws when the target port refuses
    // the connection: a bare TypeError with the `ECONNREFUSED` payload
    // nested on `.cause`. The classifier must look one level deep.
    const out = classifyProbeError({
      url,
      error: Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1234'), {
          code: 'ECONNREFUSED',
        }),
      }),
    });
    expect(out.kind).toBe('connection_refused');
    expect(out.message).toMatch(/No server is listening/);
  });

  it('classifies AbortError as a timeout with the loading-model hint', () => {
    const out = classifyProbeError({
      url,
      error: Object.assign(new Error('aborted'), { name: 'AbortError' }),
    });
    expect(out.kind).toBe('timeout');
    expect(out.message).toMatch(/loading a model/);
  });

  it('classifies ENOTFOUND as dns_failure with Docker, Podman, and native hints', () => {
    const out = classifyProbeError({
      url,
      error: Object.assign(new Error('getaddrinfo ENOTFOUND bad.host'), {
        code: 'ENOTFOUND',
      }),
    });
    expect(out.kind).toBe('dns_failure');
    expect(out.message).toMatch(/host\.docker\.internal/);
    expect(out.message).toMatch(/host\.containers\.internal/);
    expect(out.message).toMatch(/localhost/);
  });

  it('classifies TLS errors as tls_mismatch with a try-http-instead hint', () => {
    const out = classifyProbeError({
      url,
      error: new Error('write EPROTO error:SSL routines:wrong version number'),
    });
    expect(out.kind).toBe('tls_mismatch');
    expect(out.message).toMatch(/try http/);
  });

  it('classifies 401/403 as unauthorized', () => {
    expect(classifyProbeError({ url, status: 401 }).kind).toBe('unauthorized');
    expect(classifyProbeError({ url, status: 403 }).kind).toBe('unauthorized');
  });

  it('classifies 404 as not_found with a /v1/models-not-exposed hint', () => {
    const out = classifyProbeError({ url, status: 404 });
    expect(out.kind).toBe('not_found');
    expect(out.message).toMatch(/OpenAI-compatible endpoints/);
  });

  it('classifies other non-2xx as bad_status', () => {
    expect(classifyProbeError({ url, status: 502 }).kind).toBe('bad_status');
  });

  it('classifies non-JSON responses with actionable copy', () => {
    const out = classifyProbeError({ url, contentType: 'text/html' });
    expect(out.kind).toBe('non_json');
    expect(out.message).toMatch(/ends in \/v1/);
  });

  it('classifies empty model lists as empty_models', () => {
    const out = classifyProbeError({ url, emptyModels: true });
    expect(out.kind).toBe('empty_models');
    expect(out.message).toMatch(/no models/i);
  });

  it('falls back to unknown when nothing matches', () => {
    const out = classifyProbeError({ url, error: new Error('something odd') });
    expect(out.kind).toBe('unknown');
    expect(out.message).toMatch(/something odd/);
  });

  it('handles errors without a message gracefully', () => {
    const out = classifyProbeError({ url, error: {} });
    expect(out.kind).toBe('unknown');
    expect(out.message).toMatch(/unknown error/);
  });

  it('handles null error gracefully', () => {
    const out = classifyProbeError({ url, error: null });
    expect(out.kind).toBe('unknown');
  });
});
