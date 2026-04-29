import { IsNotEmpty, IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

export class SavingsQueryDto {
  @IsIn(['1h', '6h', '24h', '7d', '30d'])
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
  @IsIn(['1h', '6h', '24h', '7d', '30d'])
  range!: string;

  @IsNotEmpty()
  @IsString()
  agent_name!: string;
}
