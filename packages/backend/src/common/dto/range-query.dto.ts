import { IsOptional, IsString, IsIn } from 'class-validator';

export class RangeQueryDto {
  @IsOptional()
  @IsIn(['1h', '6h', '24h', '7d', '30d'])
  range?: string;

  @IsOptional()
  @IsString()
  agent_name?: string;
}
