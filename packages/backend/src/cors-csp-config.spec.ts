import {
  HOSTED_WINGMAN_ORIGIN,
  applyPrivateNetworkAllow,
  buildDevAllowedOrigins,
  buildFrameSrc,
  createCorsOriginHandler,
} from './cors-csp-config';

describe('HOSTED_WINGMAN_ORIGIN', () => {
  it('points at the hosted Wingman SPA', () => {
    expect(HOSTED_WINGMAN_ORIGIN).toBe('https://wingman.manifest.build');
  });
});

describe('buildDevAllowedOrigins', () => {
  it('allows the Vite frontend, both loopback Wingman ports, and the hosted Wingman (deduped)', () => {
    expect(
      buildDevAllowedOrigins({
        configuredOrigin: 'http://localhost:3000',
        wingmanPort: 3002,
      }),
    ).toEqual([
      'http://localhost:3000',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      HOSTED_WINGMAN_ORIGIN,
    ]);
  });

  it('respects a custom Wingman port and configured origin', () => {
    const allowed = buildDevAllowedOrigins({
      configuredOrigin: 'http://localhost:38240',
      wingmanPort: 38239,
    });
    expect(allowed).toContain('http://localhost:38240');
    expect(allowed).toContain('http://localhost:38239');
    expect(allowed).toContain('http://127.0.0.1:38239');
    expect(allowed).toContain(HOSTED_WINGMAN_ORIGIN);
  });
});

describe('buildFrameSrc', () => {
  it('in production, allows only self (drawer is dev-only)', () => {
    expect(buildFrameSrc({ isDev: false, wingmanPort: 3002 })).toEqual(["'self'"]);
  });

  it('in dev, allows local Wingman ports and the hosted Wingman', () => {
    expect(buildFrameSrc({ isDev: true, wingmanPort: 3002 })).toEqual([
      "'self'",
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      HOSTED_WINGMAN_ORIGIN,
    ]);
  });

  it('respects a custom Wingman port in dev', () => {
    expect(buildFrameSrc({ isDev: true, wingmanPort: 38239 })).toContain('http://localhost:38239');
  });
});

describe('createCorsOriginHandler', () => {
  const handler = createCorsOriginHandler([HOSTED_WINGMAN_ORIGIN, 'http://localhost:3000']);

  it('allows requests with no Origin header (same-origin / curl / server-to-server)', () => {
    const cb = jest.fn();
    handler(undefined, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('allows a listed origin', () => {
    const cb = jest.fn();
    handler(HOSTED_WINGMAN_ORIGIN, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('blocks an unlisted origin without surfacing an error', () => {
    const cb = jest.fn();
    handler('https://evil.example.com', cb);
    expect(cb).toHaveBeenCalledWith(null, false);
  });
});

describe('applyPrivateNetworkAllow', () => {
  const allowed = [HOSTED_WINGMAN_ORIGIN, 'http://localhost:3000'];

  it('echoes the PNA allow header for OPTIONS preflight from a listed origin', () => {
    const setHeader = jest.fn();
    applyPrivateNetworkAllow(
      {
        method: 'OPTIONS',
        headers: {
          origin: HOSTED_WINGMAN_ORIGIN,
          'access-control-request-private-network': 'true',
        },
      },
      allowed,
      setHeader,
    );
    expect(setHeader).toHaveBeenCalledWith('Access-Control-Allow-Private-Network', 'true');
  });

  it('does not echo for non-OPTIONS methods', () => {
    const setHeader = jest.fn();
    applyPrivateNetworkAllow(
      {
        method: 'GET',
        headers: {
          origin: HOSTED_WINGMAN_ORIGIN,
          'access-control-request-private-network': 'true',
        },
      },
      allowed,
      setHeader,
    );
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('does not echo when the PNA request header is missing', () => {
    const setHeader = jest.fn();
    applyPrivateNetworkAllow(
      { method: 'OPTIONS', headers: { origin: HOSTED_WINGMAN_ORIGIN } },
      allowed,
      setHeader,
    );
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('does not echo for unlisted origins (no free pass for arbitrary callers)', () => {
    const setHeader = jest.fn();
    applyPrivateNetworkAllow(
      {
        method: 'OPTIONS',
        headers: {
          origin: 'https://evil.example.com',
          'access-control-request-private-network': 'true',
        },
      },
      allowed,
      setHeader,
    );
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('does not echo when the Origin header is missing entirely', () => {
    const setHeader = jest.fn();
    applyPrivateNetworkAllow(
      {
        method: 'OPTIONS',
        headers: { 'access-control-request-private-network': 'true' },
      },
      allowed,
      setHeader,
    );
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('ignores duplicate-header arrays (Express normalises but Node http does not)', () => {
    const setHeader = jest.fn();
    applyPrivateNetworkAllow(
      {
        method: 'OPTIONS',
        headers: {
          origin: [HOSTED_WINGMAN_ORIGIN, HOSTED_WINGMAN_ORIGIN],
          'access-control-request-private-network': 'true',
        },
      },
      allowed,
      setHeader,
    );
    expect(setHeader).not.toHaveBeenCalled();
  });
});
