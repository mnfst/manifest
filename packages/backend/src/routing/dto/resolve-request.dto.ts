import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { TIERS, SPECIFICITY_CATEGORIES } from 'manifest-shared';

class MessageDto {
  @IsNotEmpty()
  role!: string;

  @IsOptional()
  content?: unknown;
}

export class ResolveRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages!: MessageDto[];

  @IsOptional()
  @IsArray()
  tools?: Record<string, unknown>[];

  @IsOptional()
  tool_choice?: unknown;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  max_tokens?: number;

  @IsOptional()
  @IsArray()
  @IsIn(TIERS, { each: true })
  recentTiers?: Array<(typeof TIERS)[number]>;

  @IsOptional()
  @IsIn(SPECIFICITY_CATEGORIES as readonly string[])
  specificity?: string;
}
