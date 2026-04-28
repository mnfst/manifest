import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const MESSAGE_STATUS_FILTER_VALUES = [
  'ok',
  'error',
  'rate_limited',
  'fallback_error',
  'errors',
] as const;
export type MessageStatusFilter = (typeof MESSAGE_STATUS_FILTER_VALUES)[number];

export class MessagesQueryDto {
  @IsOptional()
  @IsString()
  range?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  service_type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cost_min?: number;

  @IsOptional()
  @IsNumber()
  @Max(999999)
  @Type(() => Number)
  cost_max?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  agent_name?: string;

  @IsOptional()
  @IsIn(MESSAGE_STATUS_FILTER_VALUES, {
    message: `status must be one of: ${MESSAGE_STATUS_FILTER_VALUES.join(', ')}`,
  })
  status?: MessageStatusFilter;
}
