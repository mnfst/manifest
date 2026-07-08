import {
  classifyHttpErrorClass,
  classifyMessageError,
  isManifestErrorOrigin,
  ERROR_CLASSES,
  ERROR_ORIGINS,
  MANIFEST_ERROR_ORIGINS,
  TRANSPORT_NETWORK_HTTP_STATUS,
  TRANSPORT_TIMEOUT_HTTP_STATUS,
} from '../src/error-taxonomy';

describe('error-taxonomy constants', () => {
  it('pins the synthetic transport codes to 503/504', () => {
    expect(TRANSPORT_NETWORK_HTTP_STATUS).toBe(503);
    expect(TRANSPORT_TIMEOUT_HTTP_STATUS).toBe(504);
  });

  it('keeps every manifest origin inside the origin set', () => {
    for (const origin of MANIFEST_ERROR_ORIGINS) {
      expect(ERROR_ORIGINS).toContain(origin);
    }
  });

  it('produces only known classes from the HTTP mapper', () => {
    for (const code of [429, 401, 403, 404, 413, 400, 422, 500, 502, 418, 200]) {
      expect(ERROR_CLASSES).toContain(classifyHttpErrorClass(code));
    }
  });
});

describe('classifyHttpErrorClass', () => {
  it.each([
    [429, 'rate_limit'],
    [401, 'auth'],
    [403, 'auth'],
    [404, 'not_found'],
    [413, 'payload_too_large'],
    [400, 'invalid_request'],
    [422, 'invalid_request'],
    [500, 'server_error'],
    [503, 'server_error'],
    [418, 'client_error'],
    [451, 'client_error'],
    [200, 'server_error'],
    [302, 'server_error'],
  ])('maps HTTP %s to class %s', (code, expected) => {
    expect(classifyHttpErrorClass(code)).toBe(expected);
  });
});

describe('classifyMessageError', () => {
  it('classifies an ok row as no error and never superseded', () => {
    expect(classifyMessageError({ status: 'ok', errorHttpStatus: 200 })).toEqual({
      error_origin: null,
      error_class: null,
      superseded: false,
    });
  });

  it.each([
    ['no_provider', 'config', 'no_provider'],
    ['no_provider_key', 'config', 'no_provider_key'],
    ['limit_exceeded', 'policy', 'limit_exceeded'],
    ['manifest_rate_limited', 'policy', 'rate_limit'],
    ['friendly_error', 'internal', 'internal'],
  ])('maps the Manifest reason %s to %s/%s', (reason, origin, klass) => {
    expect(classifyMessageError({ status: 'error', routingReason: reason })).toEqual({
      error_origin: origin,
      error_class: klass,
      superseded: false,
    });
  });

  it('treats a 429 status as a provider rate limit even without a numeric code', () => {
    expect(classifyMessageError({ status: 'rate_limited', errorHttpStatus: null })).toEqual({
      error_origin: 'provider',
      error_class: 'rate_limit',
      superseded: false,
    });
  });

  it('classifies a rate_limited row carrying the numeric 429 as provider/rate_limit', () => {
    expect(classifyMessageError({ status: 'rate_limited', errorHttpStatus: 429 })).toEqual({
      error_origin: 'provider',
      error_class: 'rate_limit',
      superseded: false,
    });
  });

  it('maps the synthetic 504 to transport/timeout', () => {
    expect(classifyMessageError({ status: 'error', errorHttpStatus: 504 })).toEqual({
      error_origin: 'transport',
      error_class: 'timeout',
      superseded: false,
    });
  });

  it('maps the synthetic 503 to transport/network', () => {
    expect(classifyMessageError({ status: 'error', errorHttpStatus: 503 })).toEqual({
      error_origin: 'transport',
      error_class: 'network',
      superseded: false,
    });
  });

  it('classifies a numeric provider code as a provider error', () => {
    expect(classifyMessageError({ status: 'error', errorHttpStatus: 500 })).toEqual({
      error_origin: 'provider',
      error_class: 'server_error',
      superseded: false,
    });
  });

  it('classifies an errored row with no captured HTTP status as transport/network', () => {
    expect(classifyMessageError({ status: 'error', errorHttpStatus: null })).toEqual({
      error_origin: 'transport',
      error_class: 'network',
      superseded: false,
    });
  });

  it('defaults a missing errorHttpStatus to transport/network', () => {
    expect(classifyMessageError({ status: 'error' })).toEqual({
      error_origin: 'transport',
      error_class: 'network',
      superseded: false,
    });
  });

  it('marks a fallback_error row as superseded while still classifying its cause', () => {
    expect(classifyMessageError({ status: 'fallback_error', errorHttpStatus: 500 })).toEqual({
      error_origin: 'provider',
      error_class: 'server_error',
      superseded: true,
    });
  });

  it('marks an auto_fixed row (healed original) as superseded while classifying its cause', () => {
    // The failed original of a healed request was recovered by the retry, so it
    // must not count as a live fault — same as fallback_error.
    expect(classifyMessageError({ status: 'auto_fixed', errorHttpStatus: 400 })).toEqual({
      error_origin: 'provider',
      error_class: 'invalid_request',
      superseded: true,
    });
  });

  it('marks a fallback_error row with no HTTP status as superseded transport/network', () => {
    expect(classifyMessageError({ status: 'fallback_error', errorHttpStatus: null })).toEqual({
      error_origin: 'transport',
      error_class: 'network',
      superseded: true,
    });
  });

  it('lets a Manifest reason win over an incidental HTTP status on a superseded row', () => {
    expect(
      classifyMessageError({
        status: 'fallback_error',
        routingReason: 'no_provider_key',
        errorHttpStatus: 500,
      }),
    ).toEqual({ error_origin: 'config', error_class: 'no_provider_key', superseded: true });
  });
});

describe('isManifestErrorOrigin', () => {
  it.each(['config', 'policy', 'internal'])('returns true for the manifest origin %s', (origin) => {
    expect(isManifestErrorOrigin(origin)).toBe(true);
  });

  it.each(['provider', 'transport'])('returns false for the provider-side origin %s', (origin) => {
    expect(isManifestErrorOrigin(origin)).toBe(false);
  });

  it('returns false for null / undefined / unknown', () => {
    expect(isManifestErrorOrigin(null)).toBe(false);
    expect(isManifestErrorOrigin(undefined)).toBe(false);
    expect(isManifestErrorOrigin('nonsense')).toBe(false);
  });
});
