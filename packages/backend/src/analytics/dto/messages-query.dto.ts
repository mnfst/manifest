import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class MessagesQueryDto {
  @IsOptional()
  @IsIn(['1h', '6h', '24h', '7d', '30d'])
  range?: string;

  @IsOptional()
  @IsIn(['ok', 'retry', 'error'])
  status?: string;

  @IsOptional()
  @IsIn(['agent', 'browser', 'voice', 'whatsapp', 'api', 'other'])
  service_type?: string;

  @IsOptional()
  @IsString()
  model?: string;

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
}
