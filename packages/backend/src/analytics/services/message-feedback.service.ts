import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ManifestRequest } from '../../entities/request.entity';

@Injectable()
export class MessageFeedbackService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @Optional()
    @InjectRepository(ManifestRequest)
    private readonly requestRepo?: Repository<ManifestRequest>,
  ) {}

  async setFeedback(
    messageId: string,
    tenantId: string | null,
    rating: string,
    tags?: string[],
    details?: string,
  ): Promise<void> {
    if (this.requestRepo) {
      const request = await this.findOwnedRequest(messageId, tenantId);
      if (request) {
        await this.requestRepo.update(request.id, {
          feedback_rating: rating,
          feedback_tags: tags?.length ? tags.join(',') : null,
          feedback_details: details ?? null,
        });
        return;
      }
    }
    const message = await this.findOwnedMessage(messageId, tenantId, Boolean(this.requestRepo));
    await this.messageRepo.update(message.id, {
      feedback_rating: rating,
      feedback_tags: tags?.length ? tags.join(',') : null,
      feedback_details: details ?? null,
    });
  }

  async clearFeedback(messageId: string, tenantId: string | null): Promise<void> {
    if (this.requestRepo) {
      const request = await this.findOwnedRequest(messageId, tenantId);
      if (request) {
        await this.requestRepo.update(request.id, {
          feedback_rating: null,
          feedback_tags: null,
          feedback_details: null,
        });
        return;
      }
    }
    const message = await this.findOwnedMessage(messageId, tenantId, Boolean(this.requestRepo));
    await this.messageRepo.update(message.id, {
      feedback_rating: null,
      feedback_tags: null,
      feedback_details: null,
    });
  }

  private async findOwnedRequest(
    requestId: string,
    tenantId: string | null,
  ): Promise<ManifestRequest | null> {
    if (!tenantId) return null;
    return this.requestRepo!.findOne({
      where: { id: requestId, tenant_id: tenantId },
    });
  }

  private async findOwnedMessage(
    messageId: string,
    tenantId: string | null,
    syntheticOnly = false,
  ): Promise<AgentMessage> {
    // No tenant → no messages, so any id is unknown.
    if (!tenantId) throw new NotFoundException('Message not found');
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.id = :id', { id: messageId })
      .andWhere('m.tenant_id = :tenantId', { tenantId });
    if (syntheticOnly) qb.andWhere('m.request_id IS NULL');
    const message = await qb.getOne();
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }
}
