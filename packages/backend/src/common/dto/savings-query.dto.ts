import { IsNotEmpty, IsOptional, IsString, IsIn, MaxLength } from 'class-validator';
import { RANGE_VALUES } from '../utils/range.util';

export class SavingsQueryDto {
  @IsIn(RANGE_VALUES)
  range!: string;

  @IsNotEmpty()
  @IsString()
  agent_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  baseline?: string;
}

export class SavingsTimeseriesQueryDto {
  @IsIn(RANGE_VALUES)
  range!: string;

  @IsNotEmpty()
  @IsString()
  agent_name!: string;
}
