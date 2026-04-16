import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MessageFeedbackService } from './message-feedback.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

function mockQb(result: unknown = null) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  };
  return qb;
}

describe('MessageFeedbackService', () => {
  let service: MessageFeedbackService;
  let mockTenantResolve: jest.Mock;
  let mockUpdate: jest.Mock;
  let msgQb: ReturnType<typeof mockQb>;

  const baseMessage = {
    id: 'msg-1',
    tenant_id: 't1',
    user_id: 'u1',
  };

  beforeEach(async () => {
    mockTenantResolve = jest.fn().mockResolvedValue('tenant-123');
    mockUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    msgQb = mockQb(baseMessage);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageFeedbackService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(msgQb),
            update: mockUpdate,
          },
        },
        {
          provide: TenantCacheService,
          useValue: { resolve: mockTenantResolve },
        },
      ],
    }).compile();

    service = module.get<MessageFeedbackService>(MessageFeedbackService);
  });

  describe('setFeedback', () => {
    it('updates feedback columns with rating only', async () => {
      await service.setFeedback('msg-1', 'u1', 'like');

      expect(mockUpdate).toHaveBeenCalledWith('msg-1', {
        feedback_rating: 'like',
        feedback_tags: null,
        feedback_details: null,
      });
    });

    it('updates feedback with tags and details', async () => {
      await service.setFeedback('msg-1', 'u1', 'dislike', ['Too slow', 'Buggy'], 'Very slow');

      expect(mockUpdate).toHaveBeenCalledWith('msg-1', {
        feedback_rating: 'dislike',
        feedback_tags: 'Too slow,Buggy',
        feedback_details: 'Very slow',
      });
    });

    it('stores null tags when empty array provided', async () => {
      await service.setFeedback('msg-1', 'u1', 'dislike', [], 'No tags');

      expect(mockUpdate).toHaveBeenCalledWith('msg-1', {
        feedback_rating: 'dislike',
        feedback_tags: null,
        feedback_details: 'No tags',
      });
    });

    it('filters by tenantId when tenant exists', async () => {
      await service.setFeedback('msg-1', 'u1', 'like');

      expect(msgQb.andWhere).toHaveBeenCalledWith('m.tenant_id = :tenantId', {
        tenantId: 'tenant-123',
      });
    });

    it('filters by userId when tenant does not exist', async () => {
      mockTenantResolve.mockResolvedValue(null);

      await service.setFeedback('msg-1', 'u1', 'like');

      expect(msgQb.andWhere).toHaveBeenCalledWith('m.user_id = :userId', { userId: 'u1' });
    });

    it('throws NotFoundException when message not found', async () => {
      msgQb.getOne.mockResolvedValue(null);

      await expect(service.setFeedback('not-found', 'u1', 'like')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('clearFeedback', () => {
    it('sets all feedback columns to null', async () => {
      await service.clearFeedback('msg-1', 'u1');

      expect(mockUpdate).toHaveBeenCalledWith('msg-1', {
        feedback_rating: null,
        feedback_tags: null,
        feedback_details: null,
      });
    });

    it('throws NotFoundException when message not found', async () => {
      msgQb.getOne.mockResolvedValue(null);

      await expect(service.clearFeedback('not-found', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('verifies ownership before clearing', async () => {
      await service.clearFeedback('msg-1', 'u1');

      expect(msgQb.where).toHaveBeenCalledWith('m.id = :id', { id: 'msg-1' });
      expect(msgQb.andWhere).toHaveBeenCalled();
    });
  });
});
