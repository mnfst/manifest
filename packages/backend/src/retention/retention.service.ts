import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstallMetadata } from '../entities/install-metadata.entity';
import { AgentMessage } from '../entities/agent-message.entity';

@Injectable()
export class RetentionService {
	constructor(
		@InjectRepository(InstallMetadata)
		private readonly installRepo: Repository<InstallMetadata>,
		@InjectRepository(AgentMessage)
		private readonly messageRepo: Repository<AgentMessage>,
	) {}

	async getRetentionDays(): Promise<number | null> {
		const row = await this.installRepo.findOne({ where: { id: 'singleton' } });
		return row?.message_retention_days ?? null;
	}

	async setRetentionDays(days: number | null): Promise<void> {
		const existing = await this.installRepo.findOne({ where: { id: 'singleton' } });
		if (existing) {
			existing.message_retention_days = days;
			await this.installRepo.save(existing);
		} else {
			await this.installRepo.save({
				id: 'singleton',
				install_id: 'unknown',
				message_retention_days: days,
			});
		}
	}

	async purgeOldMessages(days: number): Promise<number> {
		if (days <= 0) {
			return 0;
		}
		const result = await this.messageRepo
			.createQueryBuilder()
			.delete()
			.where(`timestamp < NOW() - make_interval(days => :days)`, { days })
			.execute();
		return Number(result.affected ?? 0);
	}
}
