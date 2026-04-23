import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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

    const qb = this.messageRepo.createQueryBuilder('m').where('m.id = :id', { id: messageId });
    if (tenantId) {
      qb.andWhere('m.tenant_id = :tenantId', { tenantId });
    } else {
      qb.andWhere('m.user_id = :userId', { userId });
    }
    const message = await qb.getOne();
    if (!message) throw new NotFoundException('Message not found');

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(MessageRecording, { message_id: messageId });
      await manager.update(AgentMessage, { id: messageId }, { recorded: false });
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
  ): Promise<void> {
    await this.recordingRepo
      .createQueryBuilder()
      .insert()
      .into(MessageRecording)
      .values({
        message_id: messageId,
        request_body: payload.request_body as never,
        response_body: payload.response_body as never,
        response_headers: payload.response_headers as never,
        size_bytes: payload.size_bytes,
        created_at: new Date().toISOString(),
      })
      .orUpdate(
        ['request_body', 'response_body', 'response_headers', 'size_bytes', 'created_at'],
        ['message_id'],
      )
      .execute();
  }
}
