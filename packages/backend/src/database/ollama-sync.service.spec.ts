import { OllamaSyncService } from './ollama-sync.service';

/* ── Helpers ── */

function makeMockProviderRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
  };
}

function makeMockDiscovery() {
  return {
    discoverModels: jest.fn().mockResolvedValue([]),
  };
}

function mockFetchSuccess(models: unknown[]) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ models }),
  });
}

function mockFetchFailure(error: Error) {
  return jest.fn().mockRejectedValue(error);
}

function mockFetchNonOk(status: number) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn(),
  });
}

/* ── Tests ── */

describe('OllamaSyncService', () => {
  let service: OllamaSyncService;
  let mockProviderRepo: ReturnType<typeof makeMockProviderRepo>;
  let mockDiscovery: ReturnType<typeof makeMockDiscovery>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockProviderRepo = makeMockProviderRepo();
    mockDiscovery = makeMockDiscovery();
    service = new OllamaSyncService(mockProviderRepo as never, mockDiscovery as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /* ── No active Ollama providers: direct API ping ── */

  describe('no active Ollama providers (direct API ping)', () => {
    beforeEach(() => {
      mockProviderRepo.find.mockResolvedValue([]);
    });

    it('should return count from Ollama API when reachable', async () => {
      global.fetch = mockFetchSuccess([{ name: 'llama3' }, { name: 'phi4' }]);

      const result = await service.sync();

      expect(result).toEqual({ count: 2 });
      expect(mockDiscovery.discoverModels).not.toHaveBeenCalled();
    });

    it('should return count 0 when Ollama is unreachable', async () => {
      global.fetch = mockFetchFailure(new Error('connect ECONNREFUSED 127.0.0.1:11434'));

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });

    it('should return count 0 when fetch times out (abort)', async () => {
      global.fetch = mockFetchFailure(new DOMException('aborted', 'AbortError'));

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });

    it('should abort fetch when setTimeout callback fires', async () => {
      jest.useFakeTimers();
      global.fetch = jest.fn().mockImplementation((_url: string, opts?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }
        });
      });

      const syncPromise = service.sync();

      // Flush microtask queue so providerRepo.find() resolves and fetch is called
      await Promise.resolve();
      await Promise.resolve();

      // Advance timers to trigger the 3000ms abort timeout callback
      jest.advanceTimersByTime(3000);

      const result = await syncPromise;
      expect(result).toEqual({ count: 0 });

      jest.useRealTimers();
    });

    it('should return count 0 on non-ok HTTP response', async () => {
      global.fetch = mockFetchNonOk(500);

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });

    it('should return count 0 on 404 response', async () => {
      global.fetch = mockFetchNonOk(404);

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });

    it('should return count 0 when models array is empty', async () => {
      global.fetch = mockFetchSuccess([]);

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });

    it('should return count 0 when models key is missing', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });
  });

  /* ── Active Ollama providers: delegate to discoveryService ── */

  describe('with active Ollama providers', () => {
    it('should call discoveryService.discoverModels for each provider', async () => {
      const provider1 = { id: 'p1', provider: 'ollama', is_active: true };
      const provider2 = { id: 'p2', provider: 'ollama', is_active: true };
      mockProviderRepo.find.mockResolvedValue([provider1, provider2]);
      mockDiscovery.discoverModels
        .mockResolvedValueOnce([{ id: 'model-a' }, { id: 'model-b' }])
        .mockResolvedValueOnce([{ id: 'model-c' }]);

      const result = await service.sync();

      expect(result).toEqual({ count: 3 });
      expect(mockDiscovery.discoverModels).toHaveBeenCalledTimes(2);
      expect(mockDiscovery.discoverModels).toHaveBeenCalledWith(provider1);
      expect(mockDiscovery.discoverModels).toHaveBeenCalledWith(provider2);
    });

    it('should return count 0 when discoveryService returns empty arrays', async () => {
      const provider = { id: 'p1', provider: 'ollama', is_active: true };
      mockProviderRepo.find.mockResolvedValue([provider]);
      mockDiscovery.discoverModels.mockResolvedValue([]);

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });

    it('should not call fetch when providers exist', async () => {
      const provider = { id: 'p1', provider: 'ollama', is_active: true };
      mockProviderRepo.find.mockResolvedValue([provider]);
      mockDiscovery.discoverModels.mockResolvedValue([{ id: 'a' }]);
      global.fetch = jest.fn();

      await service.sync();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should accumulate counts across multiple providers', async () => {
      const providers = [
        { id: 'p1', provider: 'ollama', is_active: true },
        { id: 'p2', provider: 'ollama', is_active: true },
        { id: 'p3', provider: 'ollama', is_active: true },
      ];
      mockProviderRepo.find.mockResolvedValue(providers);
      mockDiscovery.discoverModels
        .mockResolvedValueOnce([{ id: 'm1' }])
        .mockResolvedValueOnce([{ id: 'm2' }, { id: 'm3' }])
        .mockResolvedValueOnce([{ id: 'm4' }, { id: 'm5' }, { id: 'm6' }]);

      const result = await service.sync();

      expect(result).toEqual({ count: 6 });
    });
  });

  /* ── Provider repo query ── */

  describe('provider lookup', () => {
    it('should query for active ollama providers', async () => {
      global.fetch = mockFetchSuccess([]);

      await service.sync();

      expect(mockProviderRepo.find).toHaveBeenCalledWith({
        where: { provider: 'ollama', is_active: true },
      });
    });
  });
});
