import { IsString, IsIn, IsNotEmpty, IsOptional } from 'class-validator';

const VALID_TIERS = ['simple', 'standard', 'complex', 'reasoning'] as const;

export class TierParamDto {
  @IsIn(VALID_TIERS)
  tier!: string;
}

export class ProviderParamDto {
  @IsString()
  @IsNotEmpty()
  provider!: string;
}

export class ConnectProviderDto {
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class SetOverrideDto {
  @IsString()
  @IsNotEmpty()
  model!: string;
}
