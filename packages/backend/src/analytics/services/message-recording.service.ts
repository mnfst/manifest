import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { MessageRecording } from '../../entities/message-recording.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

@Injectable()
export class MessageRecordingService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(MessageRecording)
    private readonly recordingRepo: Repository<MessageRecording>,
    private readonly tenantCache: TenantCacheService,
    private readonly dataSource: DataSource,
  ) {}

  async delete(messageId: string, userId: string): Promise<void> {
    const tenantId = await this.tenantCache.resolve(userId);

    await this.dataSource.transaction(async (manager) => {
      // Re-resolve the message inside the transaction so the ownership check
      // and the writes share a consistent view; FOR UPDATE prevents a racing
      // delete from making the recording disappear between SELECT and UPDATE.
      const qb = manager
        .createQueryBuilder(AgentMessage, 'm')
        .setLock('pessimistic_write')
        .where('m.id = :id', { id: messageId });
      if (tenantId) {
        qb.andWhere('m.tenant_id = :tenantId', { tenantId });
      } else {
        qb.andWhere('m.user_id = :userId', { userId });
      }
      const message = await qb.getOne();
      if (!message) throw new NotFoundException('Message not found');

      // Scope the writes by the same predicate as the SELECT so a hostile
      // messageId cannot trample another tenant's row even if the read passed.
      const ownershipFilter = tenantId
        ? { id: messageId, tenant_id: tenantId }
        : { id: messageId, user_id: userId };
      await manager.delete(MessageRecording, { message_id: messageId });
      await manager.update(AgentMessage, ownershipFilter, { recorded: false });
    });
  }

  async save(
    messageId: string,
    payload: {
      request_body: Record<string, unknown> | null;
      response_body: import('../../entities/message-recording.entity').RecordingResponseBody | null;
      response_headers: Record<string, string> | null;
      size_bytes: number;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(MessageRecording) : this.recordingRepo;
    await repo
      .createQueryBuilder()
      .insert()
      .into(MessageRecording)
      .values({
        message_id: messageId,
        request_body: payload.request_body as never,
        response_body: payload.response_body as never,
        response_headers: payload.response_headers as never,
        size_bytes: payload.size_bytes,
      })
      .orUpdate(['request_body', 'response_body', 'response_headers', 'size_bytes'], ['message_id'])
      .execute();
  }
}
