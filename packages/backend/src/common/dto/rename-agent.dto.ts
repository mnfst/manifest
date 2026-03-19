import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class RenameAgentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9 _-]+$/, {
    message: 'Agent name must contain only letters, numbers, spaces, dashes, and underscores',
  })
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  request_timeout_ms?: number;
}
