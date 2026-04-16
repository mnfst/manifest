import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

@Injectable()
export class MessageFeedbackService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly tenantCache: TenantCacheService,
  ) {}

  async setFeedback(
    messageId: string,
    userId: string,
    rating: string,
    tags?: string[],
    details?: string,
  ): Promise<void> {
    const message = await this.findOwnedMessage(messageId, userId);
    await this.messageRepo.update(message.id, {
      feedback_rating: rating,
      feedback_tags: tags?.length ? tags.join(',') : null,
      feedback_details: details ?? null,
    });
  }

  async clearFeedback(messageId: string, userId: string): Promise<void> {
    const message = await this.findOwnedMessage(messageId, userId);
    await this.messageRepo.update(message.id, {
      feedback_rating: null,
      feedback_tags: null,
      feedback_details: null,
    });
  }

  private async findOwnedMessage(messageId: string, userId: string): Promise<AgentMessage> {
    const tenantId = await this.tenantCache.resolve(userId);
    const qb = this.messageRepo.createQueryBuilder('m').where('m.id = :id', { id: messageId });
    if (tenantId) {
      qb.andWhere('m.tenant_id = :tenantId', { tenantId });
    } else {
      qb.andWhere('m.user_id = :userId', { userId });
    }
    const message = await qb.getOne();
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }
}
