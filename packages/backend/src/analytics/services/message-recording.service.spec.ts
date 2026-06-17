import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MessageRecordingService } from './message-recording.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { MessageRecording } from '../../entities/message-recording.entity';

function makeMsgQb(message: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(message),
  };
}

describe('MessageRecordingService', () => {
  let service: MessageRecordingService;
  let mockCreateQueryBuilder: jest.Mock;
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

  beforeEach(async () => {
    mockManagerDelete = jest.fn().mockResolvedValue(undefined);
    mockManagerUpdate = jest.fn().mockResolvedValue(undefined);
    mockTransaction = jest
      .fn()
      .mockImplementation(async (cb: (manager: unknown) => unknown) =>
        cb({ delete: mockManagerDelete, update: mockManagerUpdate }),
      );
    mockCreateQueryBuilder = jest.fn();

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
          useValue: { createQueryBuilder: mockCreateQueryBuilder },
        },
        {
          provide: getRepositoryToken(MessageRecording),
          useValue: recordingInsert,
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
      const qb = makeMsgQb({ id: 'msg-1' });
      mockCreateQueryBuilder.mockReturnValue(qb);

      await service.delete('msg-1', 'tenant-1');

      expect(qb.andWhere).toHaveBeenCalledWith('m.tenant_id = :tenantId', { tenantId: 'tenant-1' });
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockManagerDelete).toHaveBeenCalledWith(MessageRecording, { message_id: 'msg-1' });
      expect(mockManagerUpdate).toHaveBeenCalledWith(
        AgentMessage,
        { id: 'msg-1' },
        { recorded: false },
      );
    });

    it('throws NotFoundException when tenant is null (no tenant scope)', async () => {
      await expect(service.delete('msg-2', null)).rejects.toThrow(NotFoundException);
      expect(mockCreateQueryBuilder).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the message is not found', async () => {
      mockCreateQueryBuilder.mockReturnValue(makeMsgQb(null));

      await expect(service.delete('missing', 'tenant-1')).rejects.toThrow(NotFoundException);
      expect(mockTransaction).not.toHaveBeenCalled();
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
        ['request_body', 'response_body', 'response_headers', 'size_bytes', 'created_at'],
        ['message_id'],
      );
      expect(recordingInsert.execute).toHaveBeenCalledTimes(1);
    });
  });
});
