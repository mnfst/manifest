import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MessageRecordingService } from './message-recording.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { MessageRecording } from '../../entities/message-recording.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

function makeMsgQb(message: unknown) {
  return {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(message),
  };
}

describe('MessageRecordingService', () => {
  let service: MessageRecordingService;
  let mockManagerCreateQueryBuilder: jest.Mock;
  let mockTransaction: jest.Mock;
  let mockManagerDelete: jest.Mock;
  let mockManagerUpdate: jest.Mock;
  let recordingInsert: {
    createQueryBuilder: jest.Mock;
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orUpdate: jest.Mock;
    execute: jest.Mock;
  };
  let mockTenantResolve: jest.Mock;

  beforeEach(async () => {
    mockManagerDelete = jest.fn().mockResolvedValue(undefined);
    mockManagerUpdate = jest.fn().mockResolvedValue(undefined);
    mockManagerCreateQueryBuilder = jest.fn();
    mockTransaction = jest.fn().mockImplementation(async (cb: (manager: unknown) => unknown) =>
      cb({
        delete: mockManagerDelete,
        update: mockManagerUpdate,
        createQueryBuilder: mockManagerCreateQueryBuilder,
      }),
    );
    mockTenantResolve = jest.fn();

    recordingInsert = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageRecordingService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: {},
        },
        {
          provide: getRepositoryToken(MessageRecording),
          useValue: recordingInsert,
        },
        {
          provide: TenantCacheService,
          useValue: { resolve: mockTenantResolve },
        },
        {
          provide: DataSource,
          useValue: { transaction: mockTransaction },
        },
      ],
    }).compile();

    service = module.get(MessageRecordingService);
  });

  describe('delete', () => {
    it('deletes the recording and flips the flag within a transaction, scoped by tenant', async () => {
      mockTenantResolve.mockResolvedValue('tenant-1');
      mockManagerCreateQueryBuilder.mockReturnValue(makeMsgQb({ id: 'msg-1' }));

      await service.delete('msg-1', 'user-1');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockManagerDelete).toHaveBeenCalledWith(MessageRecording, { message_id: 'msg-1' });
      expect(mockManagerUpdate).toHaveBeenCalledWith(
        AgentMessage,
        { id: 'msg-1', tenant_id: 'tenant-1' },
        { recorded: false },
      );
    });

    it('falls back to user_id filter when tenant cannot be resolved', async () => {
      mockTenantResolve.mockResolvedValue(null);
      const qb = makeMsgQb({ id: 'msg-2' });
      mockManagerCreateQueryBuilder.mockReturnValue(qb);

      await service.delete('msg-2', 'user-2');

      expect(qb.andWhere).toHaveBeenCalledWith('m.user_id = :userId', { userId: 'user-2' });
      expect(mockManagerUpdate).toHaveBeenCalledWith(
        AgentMessage,
        { id: 'msg-2', user_id: 'user-2' },
        { recorded: false },
      );
    });

    it('locks the message row with FOR UPDATE inside the transaction', async () => {
      mockTenantResolve.mockResolvedValue('tenant-1');
      const qb = makeMsgQb({ id: 'msg-1' });
      mockManagerCreateQueryBuilder.mockReturnValue(qb);

      await service.delete('msg-1', 'user-1');

      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(mockManagerCreateQueryBuilder).toHaveBeenCalledWith(AgentMessage, 'm');
    });

    it('throws NotFoundException when the message is not found and skips writes', async () => {
      mockTenantResolve.mockResolvedValue('tenant-1');
      mockManagerCreateQueryBuilder.mockReturnValue(makeMsgQb(null));

      await expect(service.delete('missing', 'user-1')).rejects.toThrow(NotFoundException);
      expect(mockManagerDelete).not.toHaveBeenCalled();
      expect(mockManagerUpdate).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('issues an insert-or-update with the provided payload', async () => {
      await service.save('msg-3', {
        request_body: { messages: [] },
        response_body: { type: 'json', body: { ok: true } },
        response_headers: { 'content-type': 'application/json' },
        size_bytes: 42,
      });

      expect(recordingInsert.createQueryBuilder).toHaveBeenCalled();
      expect(recordingInsert.insert).toHaveBeenCalled();
      expect(recordingInsert.into).toHaveBeenCalledWith(MessageRecording);
      expect(recordingInsert.values).toHaveBeenCalled();
      const values = recordingInsert.values.mock.calls[0][0];
      expect(values.message_id).toBe('msg-3');
      expect(values.size_bytes).toBe(42);
      expect(recordingInsert.orUpdate).toHaveBeenCalledWith(
        // `created_at` deliberately omitted: a re-save (same message_id) must
        // preserve the original capture timestamp so the drawer's "Captured
        // at" header doesn't jump on every re-issue.
        ['request_body', 'response_body', 'response_headers', 'size_bytes'],
        ['message_id'],
      );
      expect(recordingInsert.execute).toHaveBeenCalledTimes(1);
    });
  });
});
