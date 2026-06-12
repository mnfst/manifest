import { IsIn, IsInt, IsPositive, ValidateIf } from 'class-validator';

const ALLOWED_DAYS = [7, 30, 90, 180] as const;

export class SetRetentionDto {
	@ValidateIf((_o, v) => v !== null)
	@IsInt()
	@IsPositive()
	@IsIn(ALLOWED_DAYS, { message: `days must be one of: ${ALLOWED_DAYS.join(', ')}` })
	days!: number | null;
}
