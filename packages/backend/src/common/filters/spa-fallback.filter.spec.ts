import { NotFoundException } from '@nestjs/common';
import { SpaFallbackFilter } from './spa-fallback.filter';

// Mock fs.existsSync to control indexPath resolution
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

import { existsSync } from 'fs';

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

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
    } as any,
    req,
    res,
  };
}

describe('SpaFallbackFilter', () => {
  const exception = new NotFoundException();

  describe('when index.html exists', () => {
    let filter: SpaFallbackFilter;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      filter = new SpaFallbackFilter();
    });

    it('serves index.html for GET to a deep SPA route', () => {
      const { host, res } = createMockHost('GET', '/agents/foo/routing');
      filter.catch(exception, host);
      expect(res.sendFile).toHaveBeenCalledWith(expect.stringContaining('index.html'));
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
    let filter: SpaFallbackFilter;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
      filter = new SpaFallbackFilter();
    });

    it('returns JSON 404 even for GET to a deep SPA route', () => {
      const { host, res } = createMockHost('GET', '/agents/foo/routing');
      filter.catch(exception, host);
      expect(res.sendFile).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
