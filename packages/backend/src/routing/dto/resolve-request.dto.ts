import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_TIERS = ['simple', 'standard', 'complex', 'reasoning'] as const;

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
  @IsIn(VALID_TIERS, { each: true })
  recentTiers?: Array<(typeof VALID_TIERS)[number]>;
}
