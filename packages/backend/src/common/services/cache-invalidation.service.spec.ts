import { CacheInvalidationService } from './cache-invalidation.service';
import { IngestEventBusService } from './ingest-event-bus.service';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let eventBus: IngestEventBusService;
  let mockDel: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new IngestEventBusService();
    mockDel = jest.fn().mockResolvedValue(undefined);
    const mockCacheManager = { del: mockDel } as never;
    service = new CacheInvalidationService(mockCacheManager, eventBus);
  });

  afterEach(() => {
    service.onModuleDestroy();
    eventBus.onModuleDestroy();
    jest.useRealTimers();
  });

  describe('trackKey', () => {
    it('should track a cache key for a user', () => {
      service.trackKey('user-1', 'user-1:/api/v1/overview');

      // Verify tracking by triggering invalidation and checking del calls
      service.onModuleInit();
      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).toHaveBeenCalledWith('user-1:/api/v1/overview');
    });

    it('should track multiple keys for the same user', () => {
      service.trackKey('user-1', 'user-1:/api/v1/overview');
      service.trackKey('user-1', 'user-1:/api/v1/tokens');
      service.trackKey('user-1', 'user-1:/api/v1/costs');

      service.onModuleInit();
      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).toHaveBeenCalledTimes(3);
      expect(mockDel).toHaveBeenCalledWith('user-1:/api/v1/overview');
      expect(mockDel).toHaveBeenCalledWith('user-1:/api/v1/tokens');
      expect(mockDel).toHaveBeenCalledWith('user-1:/api/v1/costs');
    });

    it('should not duplicate keys when the same key is tracked twice', () => {
      service.trackKey('user-1', 'user-1:/api/v1/overview');
      service.trackKey('user-1', 'user-1:/api/v1/overview');

      service.onModuleInit();
      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).toHaveBeenCalledTimes(1);
    });

    it('should track keys independently per user', () => {
      service.trackKey('user-1', 'user-1:/api/v1/overview');
      service.trackKey('user-2', 'user-2:/api/v1/overview');

      service.onModuleInit();
      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).toHaveBeenCalledTimes(1);
      expect(mockDel).toHaveBeenCalledWith('user-1:/api/v1/overview');
    });
  });

  describe('invalidation on event bus emission', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should delete all tracked keys for the emitted user', () => {
      service.trackKey('user-1', 'key-a');
      service.trackKey('user-1', 'key-b');

      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).toHaveBeenCalledWith('key-a');
      expect(mockDel).toHaveBeenCalledWith('key-b');
    });

    it('should clear tracked keys after invalidation', () => {
      service.trackKey('user-1', 'key-a');

      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);
      mockDel.mockClear();

      // Second emission should not delete anything (keys were cleared)
      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).not.toHaveBeenCalled();
    });

    it('should not affect other users when invalidating one user', () => {
      service.trackKey('user-1', 'user-1-key');
      service.trackKey('user-2', 'user-2-key');

      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).toHaveBeenCalledWith('user-1-key');
      expect(mockDel).not.toHaveBeenCalledWith('user-2-key');
    });

    it('should be a no-op when no keys are tracked for the user', () => {
      eventBus.emit('unknown-user');
      jest.advanceTimersByTime(1000);

      expect(mockDel).not.toHaveBeenCalled();
    });

    it('should allow re-tracking keys after invalidation', () => {
      service.trackKey('user-1', 'key-a');

      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);
      mockDel.mockClear();

      // Re-track a new key
      service.trackKey('user-1', 'key-b');
      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).toHaveBeenCalledTimes(1);
      expect(mockDel).toHaveBeenCalledWith('key-b');
    });
  });

  describe('onModuleDestroy', () => {
    it('should unsubscribe from event bus on destroy', () => {
      service.onModuleInit();
      service.trackKey('user-1', 'key-a');

      service.onModuleDestroy();

      // Emit after destroy should not trigger invalidation
      eventBus.emit('user-1');
      jest.advanceTimersByTime(1000);

      expect(mockDel).not.toHaveBeenCalled();
    });

    it('should handle destroy before init gracefully', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });
});
