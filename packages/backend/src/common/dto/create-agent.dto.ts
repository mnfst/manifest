import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsIn,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsUUID,
} from 'class-validator';
import { AGENT_CATEGORIES, AGENT_PLATFORMS } from 'manifest-shared';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9 _-]+$/, {
    message: 'Agent name must contain only letters, numbers, spaces, dashes, and underscores',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn([...AGENT_CATEGORIES])
  agent_category?: string;

  @IsOptional()
  @IsString()
  @IsIn([...AGENT_PLATFORMS])
  agent_platform?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  global_provider_ids?: string[];
}
