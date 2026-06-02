import { IsOptional, IsString, IsIn } from 'class-validator';
import { RANGE_VALUES } from '../utils/range.util';

export class RangeQueryDto {
  @IsOptional()
  @IsIn(RANGE_VALUES)
  range?: string;

  @IsOptional()
  @IsString()
  agent_name?: string;
}
