import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ALL_TIERS,
  SPECIFICITY_CATEGORIES,
  type MessageTier,
  type SpecificityCategory,
} from 'manifest-shared';

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
  @Min(0)
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

  @IsOptional()
  @IsIn(ALL_TIERS, {
    message: `routing_tier must be one of: ${ALL_TIERS.join(', ')}`,
  })
  routing_tier?: MessageTier;

  @IsOptional()
  @IsIn(SPECIFICITY_CATEGORIES, {
    message: `specificity_category must be one of: ${SPECIFICITY_CATEGORIES.join(', ')}`,
  })
  specificity_category?: SpecificityCategory;

  @IsOptional()
  @IsString()
  header_tier_id?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  include_total?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  include_filter_options?: boolean;
}
