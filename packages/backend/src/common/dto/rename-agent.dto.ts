import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AGENT_CATEGORIES, AGENT_PLATFORMS } from 'manifest-shared';

export const MIN_CONTEXT_FLOOR_OVERRIDE = 1024;
export const MAX_CONTEXT_FLOOR_OVERRIDE = 10_000_000;

export class RenameAgentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9 _-]+$/, {
    message: 'Agent name must contain only letters, numbers, spaces, dashes, and underscores',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn([...AGENT_CATEGORIES])
  agent_category?: string;

  @IsOptional()
  @IsString()
  @IsIn([...AGENT_PLATFORMS])
  agent_platform?: string;

  /**
   * Overrides the `context_length` advertised on GET /v1/models. `null`
   * clears the override and restores the computed floor. Validation range
   * gives users room to experiment without letting them advertise absurd
   * values to their agents.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }) => (value === null ? null : value))
  @IsInt()
  @Min(MIN_CONTEXT_FLOOR_OVERRIDE)
  @Max(MAX_CONTEXT_FLOOR_OVERRIDE)
  context_floor_override?: number | null;
}
