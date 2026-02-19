import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class SecurityEventDto {
  @IsIn(['critical', 'warning', 'info'])
  severity!: string;

  @IsString()
  category!: string;

  @IsString()
  description!: string;
}

export class TelemetryEventDto {
  @IsString()
  timestamp!: string;

  @IsString()
  description!: string;

  @IsIn(['agent', 'browser', 'voice', 'whatsapp', 'api', 'other'])
  service_type!: string;

  @IsIn(['ok', 'retry', 'error'])
  status!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  agent_name?: string;

  @IsOptional()
  @IsString()
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

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SecurityEventDto)
  security_event?: SecurityEventDto;
}

export class CreateTelemetryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => TelemetryEventDto)
  events!: TelemetryEventDto[];
}
