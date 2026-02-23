import {
  IsString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsString()
  @IsNotEmpty()
  apiKey!: string;
}

export class SetOverrideDto {
  @IsString()
  @IsNotEmpty()
  model!: string;
}

export class TierOverrideItem {
  @IsIn(VALID_TIERS)
  tier!: string;

  @IsOptional()
  @IsString()
  model!: string | null;
}

export class BulkSaveTiersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TierOverrideItem)
  tiers!: TierOverrideItem[];

  @IsOptional()
  @IsString()
  preset?: string;

  @IsOptional()
  @IsString()
  fromPreset?: string;
}
