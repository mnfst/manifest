import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TelemetryEventDto {
  @IsString()
  @MaxLength(50)
  timestamp!: string;

  @IsString()
  @MaxLength(4096)
  description!: string;

  @IsIn(['agent', 'browser', 'voice', 'whatsapp', 'api', 'other'])
  service_type!: string;

  @IsIn(['ok', 'retry', 'error'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  agent_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  skill_name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  input_tokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  output_tokens?: number;
}

export class CreateTelemetryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => TelemetryEventDto)
  events!: TelemetryEventDto[];
}
