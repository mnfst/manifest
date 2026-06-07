import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RetentionService } from './retention.service';
import { InstallMetadata } from '../entities/install-metadata.entity';
import { AgentMessage } from '../entities/agent-message.entity';

describe('RetentionService', () => {
	let service: RetentionService;
	let installRepo: { findOne: jest.Mock; save: jest.Mock };
	let qb: { delete: jest.Mock; where: jest.Mock; execute: jest.Mock };
	let messageRepo: { createQueryBuilder: jest.Mock };

	beforeEach(async () => {
		installRepo = { findOne: jest.fn(), save: jest.fn() };
		qb = {
			delete: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({ affected: 5 }),
		};
		messageRepo = { createQueryBuilder: jest.fn(() => qb) };

		const module = await Test.createTestingModule({
			providers: [
				RetentionService,
				{ provide: getRepositoryToken(InstallMetadata), useValue: installRepo },
				{ provide: getRepositoryToken(AgentMessage), useValue: messageRepo },
			],
		}).compile();

		service = module.get(RetentionService);
	});

	describe('getRetentionDays', () => {
		it('returns null when no row exists', async () => {
			installRepo.findOne.mockResolvedValue(null);
			expect(await service.getRetentionDays()).toBeNull();
		});

		it('returns null when row exists but column is null', async () => {
			installRepo.findOne.mockResolvedValue({ message_retention_days: null });
			expect(await service.getRetentionDays()).toBeNull();
		});

		it('returns the column value', async () => {
			installRepo.findOne.mockResolvedValue({ message_retention_days: 30 });
			expect(await service.getRetentionDays()).toBe(30);
		});
	});

	describe('setRetentionDays', () => {
		it('updates existing row', async () => {
			const existing = { id: 'singleton', install_id: 'abc', message_retention_days: null };
			installRepo.findOne.mockResolvedValue(existing);
			await service.setRetentionDays(30);
			expect(existing.message_retention_days).toBe(30);
			expect(installRepo.save).toHaveBeenCalledWith(existing);
		});

		it('creates new row when none exists', async () => {
			installRepo.findOne.mockResolvedValue(null);
			await service.setRetentionDays(7);
			expect(installRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'singleton', message_retention_days: 7 }),
			);
		});

		it('accepts null (keep forever)', async () => {
			const existing = { id: 'singleton', install_id: 'abc', message_retention_days: 30 };
			installRepo.findOne.mockResolvedValue(existing);
			await service.setRetentionDays(null);
			expect(existing.message_retention_days).toBeNull();
		});
	});

	describe('purgeOldMessages', () => {
		it('builds query with make_interval and returns affected count', async () => {
			const result = await service.purgeOldMessages(30);
			expect(qb.delete).toHaveBeenCalled();
			expect(qb.where).toHaveBeenCalledWith('timestamp < NOW() - make_interval(days => :days)', {
				days: 30,
			});
			expect(qb.execute).toHaveBeenCalled();
			expect(result).toBe(5);
		});

		it('returns 0 when affected is undefined', async () => {
			qb.execute.mockResolvedValue({ affected: undefined });
			const result = await service.purgeOldMessages(7);
			expect(result).toBe(0);
		});
	});
});
