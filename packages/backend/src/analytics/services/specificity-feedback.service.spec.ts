import { NotFoundException } from '@nestjs/common';
import { SpecificityFeedbackService } from './specificity-feedback.service';
import type { Repository } from 'typeorm';
import type { AgentMessage } from '../../entities/agent-message.entity';
import type { TenantCacheService } from '../../common/services/tenant-cache.service';

describe('SpecificityFeedbackService', () => {
  let service: SpecificityFeedbackService;
  let messageRepo: {
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
  };
  let tenantCache: { resolve: jest.Mock };

  function setOwnedMessage(message: Partial<AgentMessage> | null) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(message),
    };
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);
    return qb;
  }

  beforeEach(() => {
    messageRepo = {
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    tenantCache = {
      resolve: jest.fn().mockResolvedValue('tenant-1'),
    };
    service = new SpecificityFeedbackService(
      messageRepo as unknown as Repository<AgentMessage>,
      tenantCache as unknown as TenantCacheService,
    );
  });

  describe('flagMiscategorized', () => {
    it('sets the flag on a specificity-routed owned message', async () => {
      setOwnedMessage({ id: 'msg-1', specificity_category: 'web_browsing' });

      await service.flagMiscategorized('msg-1', 'user-1');

      expect(messageRepo.update).toHaveBeenCalledWith('msg-1', {
        specificity_miscategorized: true,
      });
    });

    it('rejects messages that were not routed by specificity', async () => {
      setOwnedMessage({ id: 'msg-1', specificity_category: null });

      await expect(service.flagMiscategorized('msg-1', 'user-1')).rejects.toThrow(
        'Message was not routed by specificity',
      );
      expect(messageRepo.update).not.toHaveBeenCalled();
    });

    it('throws 404 when the message is not owned by the user', async () => {
      setOwnedMessage(null);

      await expect(service.flagMiscategorized('msg-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('falls back to user_id ownership lookup when the user has no tenant', async () => {
      // Legacy / pre-tenant rows fall into this branch — the message must
      // still be reachable by its owner.
      tenantCache.resolve.mockResolvedValueOnce(null);
      const qb = setOwnedMessage({ id: 'msg-1', specificity_category: 'coding' });

      await service.flagMiscategorized('msg-1', 'user-1');

      expect(qb.andWhere).toHaveBeenCalledWith('m.user_id = :userId', { userId: 'user-1' });
      expect(qb.andWhere).not.toHaveBeenCalledWith('m.tenant_id = :tenantId', expect.anything());
    });
  });

  describe('clearFlag', () => {
    it('clears the flag on an owned message', async () => {
      setOwnedMessage({ id: 'msg-1', specificity_category: 'web_browsing' });

      await service.clearFlag('msg-1', 'user-1');

      expect(messageRepo.update).toHaveBeenCalledWith('msg-1', {
        specificity_miscategorized: false,
      });
    });
  });

  describe('getPenaltiesForAgent', () => {
    function setRawMany(rows: { category: string; count: number }[]) {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };
      messageRepo.createQueryBuilder.mockReturnValueOnce(qb);
      return qb;
    }

    it('aggregates flag counts into per-category penalties', async () => {
      setRawMany([
        { category: 'web_browsing', count: 2 },
        { category: 'coding', count: 1 },
      ]);

      const penalties = await service.getPenaltiesForAgent('tenant-1', 'agent-1');

      expect(penalties.get('web_browsing')).toBeCloseTo(1.5);
      expect(penalties.get('coding')).toBeCloseTo(0.75);
    });

    it('caps penalties so a category can never be fully disabled', async () => {
      setRawMany([{ category: 'web_browsing', count: 100 }]);

      const penalties = await service.getPenaltiesForAgent('tenant-1', 'agent-1');

      expect(penalties.get('web_browsing')).toBe(3);
    });

    it('ignores unknown category values', async () => {
      setRawMany([{ category: 'not_a_category', count: 10 }]);

      const penalties = await service.getPenaltiesForAgent('tenant-1', 'agent-1');

      expect(penalties.size).toBe(0);
    });

    it('returns empty when no agentId is supplied', async () => {
      const penalties = await service.getPenaltiesForAgent('tenant-1', null);

      expect(penalties.size).toBe(0);
      expect(messageRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
