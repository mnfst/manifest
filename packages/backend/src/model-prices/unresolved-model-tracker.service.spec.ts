import { UnresolvedModelTrackerService } from './unresolved-model-tracker.service';
import { UnresolvedModel } from '../entities/unresolved-model.entity';

describe('UnresolvedModelTrackerService', () => {
  let service: UnresolvedModelTrackerService;
  let mockRepo: {
    findOneBy: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(() => {
    mockRepo = {
      findOneBy: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => ({ ...data }) as UnresolvedModel),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    service = new UnresolvedModelTrackerService(mockRepo as never);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('track', () => {
    it('should accumulate counts for the same model', async () => {
      service.track('unknown-model');
      service.track('unknown-model');
      service.track('unknown-model');

      mockRepo.findOneBy.mockResolvedValue(null);
      await service.flush();

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ occurrence_count: 3 }),
      );
    });

    it('should track multiple distinct models', async () => {
      service.track('model-a');
      service.track('model-b');

      mockRepo.findOneBy.mockResolvedValue(null);
      await service.flush();

      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('flush', () => {
    it('should do nothing when no pending entries', async () => {
      await service.flush();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should insert new entries for unseen models', async () => {
      service.track('new-model');
      mockRepo.findOneBy.mockResolvedValue(null);

      await service.flush();

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model_name: 'new-model',
          occurrence_count: 1,
          resolved: false,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should update existing entries by incrementing count', async () => {
      const existing = {
        model_name: 'known-unresolved',
        occurrence_count: 5,
        last_seen: new Date('2024-01-01'),
      } as UnresolvedModel;

      service.track('known-unresolved');
      service.track('known-unresolved');
      mockRepo.findOneBy.mockResolvedValue(existing);

      await service.flush();

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ occurrence_count: 7 }),
      );
    });

    it('should set first_seen and last_seen as Date objects for new entries', async () => {
      service.track('brand-new-model');
      mockRepo.findOneBy.mockResolvedValue(null);

      await service.flush();

      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.first_seen).toBeInstanceOf(Date);
      expect(createArg.last_seen).toBeInstanceOf(Date);
    });

    it('should update last_seen as Date on existing entries', async () => {
      const existing = {
        model_name: 'old-model',
        occurrence_count: 3,
        last_seen: new Date('2024-01-01'),
      } as UnresolvedModel;

      service.track('old-model');
      mockRepo.findOneBy.mockResolvedValue(existing);

      await service.flush();

      expect(existing.last_seen).toBeInstanceOf(Date);
      expect(existing.last_seen.getTime()).toBeGreaterThan(
        new Date('2024-01-01').getTime(),
      );
    });

    it('should clear pending entries after flush', async () => {
      service.track('some-model');
      mockRepo.findOneBy.mockResolvedValue(null);

      await service.flush();
      jest.clearAllMocks();

      await service.flush();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getUnresolved', () => {
    it('should return unresolved entries ordered by count', async () => {
      const entries = [
        { model_name: 'b', occurrence_count: 10 },
        { model_name: 'a', occurrence_count: 5 },
      ];
      mockRepo.find.mockResolvedValue(entries);

      const result = await service.getUnresolved();

      expect(result).toEqual(entries);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { resolved: false },
        order: { occurrence_count: 'DESC' },
      });
    });
  });

  describe('markResolved', () => {
    it('should mark an entry as resolved', async () => {
      await service.markResolved('unknown-model', 'gpt-4o');

      expect(mockRepo.update).toHaveBeenCalledWith(
        { model_name: 'unknown-model' },
        expect.objectContaining({
          resolved: true,
          resolved_to: 'gpt-4o',
        }),
      );
    });

    it('should set resolved_at to a valid date', async () => {
      await service.markResolved('unknown-model', 'gpt-4o');

      const updateCall = mockRepo.update.mock.calls[0];
      expect(updateCall[1].resolved_at).toBeInstanceOf(Date);
    });
  });

  describe('onModuleDestroy', () => {
    it('should clean up the interval timer', () => {
      service.onModuleDestroy();
      // No error thrown means the timer was cleared successfully
    });

    it('should be safe to call twice', () => {
      service.onModuleDestroy();
      service.onModuleDestroy();
      // No error thrown means idempotent cleanup works
    });
  });

  describe('flush error handling', () => {
    it('should propagate errors from upsertEntry', async () => {
      service.track('fail-model');
      mockRepo.findOneBy.mockRejectedValue(new Error('DB down'));

      await expect(service.flush()).rejects.toThrow('DB down');
    });
  });
});
