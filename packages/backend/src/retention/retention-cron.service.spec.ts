import { Test } from '@nestjs/testing';
import { RetentionCronService } from './retention-cron.service';
import { RetentionService } from './retention.service';

describe('RetentionCronService', () => {
	let service: RetentionCronService;
	let retention: { getRetentionDays: jest.Mock; purgeOldMessages: jest.Mock };

	beforeEach(async () => {
		retention = { getRetentionDays: jest.fn(), purgeOldMessages: jest.fn() };
		const module = await Test.createTestingModule({
			providers: [RetentionCronService, { provide: RetentionService, useValue: retention }],
		}).compile();
		service = module.get(RetentionCronService);
	});

	it('skips purge when retention is null', async () => {
		retention.getRetentionDays.mockResolvedValue(null);
		const result = await service.runOnce();
		expect(retention.purgeOldMessages).not.toHaveBeenCalled();
		expect(result).toBe(0);
	});

	it('purges when retention is set', async () => {
		retention.getRetentionDays.mockResolvedValue(30);
		retention.purgeOldMessages.mockResolvedValue(10);
		const result = await service.runOnce();
		expect(retention.purgeOldMessages).toHaveBeenCalledWith(30);
		expect(result).toBe(10);
	});

	it('returns 0 on error without throwing', async () => {
		retention.getRetentionDays.mockRejectedValue(new Error('db down'));
		const result = await service.runOnce();
		expect(result).toBe(0);
	});

	it('onModuleInit calls runOnce', async () => {
		retention.getRetentionDays.mockResolvedValue(7);
		retention.purgeOldMessages.mockResolvedValue(3);
		await service.onModuleInit();
		expect(retention.purgeOldMessages).toHaveBeenCalledWith(7);
	});

	it('onModuleInit swallows errors', async () => {
		retention.getRetentionDays.mockRejectedValue(new Error('init fail'));
		await expect(service.onModuleInit()).resolves.toBeUndefined();
	});
});
