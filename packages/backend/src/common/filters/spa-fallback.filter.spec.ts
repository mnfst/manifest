import { NotFoundException } from '@nestjs/common';

jest.mock('../utils/frontend-path', () => ({
  resolveFrontendDir: jest.fn(),
}));

import { resolveFrontendDir } from '../utils/frontend-path';

const mockResolveFrontendDir = resolveFrontendDir as jest.MockedFunction<typeof resolveFrontendDir>;

function createMockHost(method: string, url: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const sendFile = jest.fn();
  const res = { status, json, sendFile };
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

    it('serves index.html for GET to a deep SPA route', () => {
      const { host, res } = createMockHost('GET', '/agents/foo/routing');
      filter.catch(exception, host);
      expect(res.sendFile).toHaveBeenCalledWith('/mock/frontend/index.html');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns JSON 404 for GET to /api/ routes', () => {
      const { host, res } = createMockHost('GET', '/api/v1/nonexistent');
      filter.catch(exception, host);
      expect(res.sendFile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns JSON 404 for GET to /otlp/ routes', () => {
      const { host, res } = createMockHost('GET', '/otlp/v1/unknown');
      filter.catch(exception, host);
      expect(res.sendFile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns JSON 404 for GET to /v1/ routes', () => {
      const { host, res } = createMockHost('GET', '/v1/something');
      filter.catch(exception, host);
      expect(res.sendFile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns JSON 404 for non-GET requests', () => {
      const { host, res } = createMockHost('POST', '/agents/foo');
      filter.catch(exception, host);
      expect(res.sendFile).not.toHaveBeenCalled();
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
      expect(res.sendFile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
