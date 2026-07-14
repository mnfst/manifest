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
      await this.requestRepo.update(request.id, {
        feedback_rating: rating,
        feedback_tags: tags?.length ? tags.join(',') : null,
        feedback_details: details ?? null,
      });
      return;
    }
    const message = await this.findOwnedMessage(messageId, tenantId);
    await this.messageRepo.update(message.id, {
      feedback_rating: rating,
      feedback_tags: tags?.length ? tags.join(',') : null,
      feedback_details: details ?? null,
    });
  }

  async clearFeedback(messageId: string, tenantId: string | null): Promise<void> {
    if (this.requestRepo) {
      const request = await this.findOwnedRequest(messageId, tenantId);
      await this.requestRepo.update(request.id, {
        feedback_rating: null,
        feedback_tags: null,
        feedback_details: null,
      });
      return;
    }
    const message = await this.findOwnedMessage(messageId, tenantId);
    await this.messageRepo.update(message.id, {
      feedback_rating: null,
      feedback_tags: null,
      feedback_details: null,
    });
  }

  private async findOwnedRequest(
    requestId: string,
    tenantId: string | null,
  ): Promise<ManifestRequest> {
    if (!tenantId) throw new NotFoundException('Request not found');
    const request = await this.requestRepo!.findOne({
      where: { id: requestId, tenant_id: tenantId },
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  private async findOwnedMessage(
    messageId: string,
    tenantId: string | null,
  ): Promise<AgentMessage> {
    // No tenant → no messages, so any id is unknown.
    if (!tenantId) throw new NotFoundException('Message not found');
    const message = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.id = :id', { id: messageId })
      .andWhere('m.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }
}
