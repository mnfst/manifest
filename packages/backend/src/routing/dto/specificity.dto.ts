import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AUTH_TYPES } from 'manifest-shared';
import { ModelRouteDto, MAX_PROVIDER_KEY_LABEL_LENGTH } from './routing.dto';

export class SetSpecificityOverrideDto {
  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  provider?: string;

  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: 'api_key' | 'subscription' | 'local';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PROVIDER_KEY_LABEL_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  providerKeyLabel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelRouteDto)
  route?: ModelRouteDto;
}

export class ToggleSpecificityDto {
  @IsBoolean()
  active!: boolean;
}
