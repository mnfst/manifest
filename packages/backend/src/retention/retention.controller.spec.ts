import { Test } from '@nestjs/testing';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';

describe('RetentionController', () => {
	let controller: RetentionController;
	let service: { getRetentionDays: jest.Mock; setRetentionDays: jest.Mock };

	beforeEach(async () => {
		service = { getRetentionDays: jest.fn(), setRetentionDays: jest.fn() };
		const module = await Test.createTestingModule({
			controllers: [RetentionController],
			providers: [{ provide: RetentionService, useValue: service }],
		}).compile();
		controller = module.get(RetentionController);
	});

	describe('get', () => {
		it('returns { days } when retention is set', async () => {
			service.getRetentionDays.mockResolvedValue(30);
			const result = await controller.get();
			expect(result).toEqual({ days: 30 });
		});

		it('returns { days: null } when forever', async () => {
			service.getRetentionDays.mockResolvedValue(null);
			const result = await controller.get();
			expect(result).toEqual({ days: null });
		});
	});

	describe('patch', () => {
		it('saves days and echoes back', async () => {
			service.setRetentionDays.mockResolvedValue(undefined);
			const result = await controller.patch({ days: 30 } as any);
			expect(service.setRetentionDays).toHaveBeenCalledWith(30);
			expect(result).toEqual({ days: 30 });
		});

		it('accepts null (keep forever)', async () => {
			service.setRetentionDays.mockResolvedValue(undefined);
			const result = await controller.patch({ days: null } as any);
			expect(service.setRetentionDays).toHaveBeenCalledWith(null);
			expect(result).toEqual({ days: null });
		});
	});
});
