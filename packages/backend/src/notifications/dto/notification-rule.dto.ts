import { IsString, IsIn, IsNumber, Min, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotificationRuleDto {
  @IsString()
  agent_name!: string;

  @IsIn(['tokens', 'cost'])
  metric_type!: 'tokens' | 'cost';

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  threshold!: number;

  @IsIn(['hour', 'day', 'week', 'month'])
  period!: 'hour' | 'day' | 'week' | 'month';
}

export class UpdateNotificationRuleDto {
  @IsOptional()
  @IsIn(['tokens', 'cost'])
  metric_type?: 'tokens' | 'cost';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  threshold?: number;

  @IsOptional()
  @IsIn(['hour', 'day', 'week', 'month'])
  period?: 'hour' | 'day' | 'week' | 'month';

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_active?: boolean;
}
