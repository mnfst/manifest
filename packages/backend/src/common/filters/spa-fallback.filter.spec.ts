import { NotFoundException } from '@nestjs/common';

jest.mock('../utils/frontend-path', () => ({
  resolveFrontendDir: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockReturnValue('<html><body>SPA</body></html>'),
}));

import { resolveFrontendDir } from '../utils/frontend-path';

const mockResolveFrontendDir = resolveFrontendDir as jest.MockedFunction<typeof resolveFrontendDir>;

function createMockHost(method: string, url: string) {
  const json = jest.fn();
  const send = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json, send });
  const res = { status, json, send, setHeader };
  const req = { method, originalUrl: url };

  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    req,
    res,
  };
}

describe('SpaFallbackFilter', () => {
  const exception = new NotFoundException();

  // Must re-import after mock setup to pick up the mocked module
  function loadFilter() {
    jest.resetModules();
    jest.mock('../utils/frontend-path', () => ({
      resolveFrontendDir: mockResolveFrontendDir,
    }));
    jest.mock('fs', () => ({
      ...jest.requireActual('fs'),
      readFileSync: jest.fn().mockReturnValue('<html><body>SPA</body></html>'),
    }));
    const { SpaFallbackFilter } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./spa-fallback.filter') as typeof import('./spa-fallback.filter');
    return new SpaFallbackFilter();
  }

  describe('when index.html exists', () => {
    let filter: ReturnType<typeof loadFilter>;

    beforeEach(() => {
      mockResolveFrontendDir.mockReturnValue('/mock/frontend');
      filter = loadFilter();
    });

    it('serves cached index.html content for GET to a deep SPA route', () => {
      const { host, res } = createMockHost('GET', '/agents/foo/routing');
      filter.catch(exception, host);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('<html><body>SPA</body></html>');
    });

    it('returns JSON 404 for GET to /api/ routes', () => {
      const { host, res } = createMockHost('GET', '/api/v1/nonexistent');
      filter.catch(exception, host);
      expect(res.send).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns JSON 404 for GET to /otlp/ routes', () => {
      const { host, res } = createMockHost('GET', '/otlp/v1/unknown');
      filter.catch(exception, host);
      expect(res.send).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns JSON 404 for GET to /v1/ routes', () => {
      const { host, res } = createMockHost('GET', '/v1/something');
      filter.catch(exception, host);
      expect(res.send).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns JSON 404 for non-GET requests', () => {
      const { host, res } = createMockHost('POST', '/agents/foo');
      filter.catch(exception, host);
      expect(res.send).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('when index.html does not exist', () => {
    let filter: ReturnType<typeof loadFilter>;

    beforeEach(() => {
      mockResolveFrontendDir.mockReturnValue(null);
      filter = loadFilter();
    });

    it('returns JSON 404 even for GET to a deep SPA route', () => {
      const { host, res } = createMockHost('GET', '/agents/foo/routing');
      filter.catch(exception, host);
      expect(res.send).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
