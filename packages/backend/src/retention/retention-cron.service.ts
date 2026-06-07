import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetentionService } from './retention.service';

@Injectable()
export class RetentionCronService implements OnModuleInit {
	private readonly logger = new Logger(RetentionCronService.name);

	constructor(private readonly service: RetentionService) {}

	async onModuleInit(): Promise<void> {
		await this.runOnce();
	}

	@Cron(CronExpression.EVERY_HOUR)
	async runOnce(): Promise<number> {
		try {
			const days = await this.service.getRetentionDays();
			if (days === null) {
				return 0;
			}
			const count = await this.service.purgeOldMessages(days);
			this.logger.log(`Purged ${count} message(s) older than ${days} day(s)`);
			return count;
		} catch (err) {
			this.logger.error('Retention purge failed', err instanceof Error ? err.stack : err);
			return 0;
		}
	}
}
