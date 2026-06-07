import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetRetentionDto } from './set-retention.dto';

describe('SetRetentionDto', () => {
	it('accepts null (keep forever)', async () => {
		const dto = plainToInstance(SetRetentionDto, { days: null });
		const errors = await validate(dto);
		expect(errors).toHaveLength(0);
	});

	it('accepts 7', async () => {
		const dto = plainToInstance(SetRetentionDto, { days: 7 });
		const errors = await validate(dto);
		expect(errors).toHaveLength(0);
	});

	it('accepts 30, 90, 180', async () => {
		for (const days of [30, 90, 180]) {
			const dto = plainToInstance(SetRetentionDto, { days });
			const errors = await validate(dto);
			expect(errors).toHaveLength(0);
		}
	});

	it('rejects 60', async () => {
		const dto = plainToInstance(SetRetentionDto, { days: 60 });
		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
	});

	it('rejects negative numbers', async () => {
		const dto = plainToInstance(SetRetentionDto, { days: -1 });
		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
	});

	it('rejects string', async () => {
		const dto = plainToInstance(SetRetentionDto, { days: '30' });
		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
	});

	it('rejects zero', async () => {
		const dto = plainToInstance(SetRetentionDto, { days: 0 });
		const errors = await validate(dto);
		expect(errors.length).toBeGreaterThan(0);
	});
});
