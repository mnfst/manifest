import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean, MaxLength } from 'class-validator';
import { AUTH_TYPES } from 'manifest-shared';
import { MAX_PROVIDER_KEY_LABEL_LENGTH } from './routing.dto';

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
  authType?: 'api_key' | 'subscription';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PROVIDER_KEY_LABEL_LENGTH)
  providerKeyLabel?: string;
}

export class ToggleSpecificityDto {
  @IsBoolean()
  active!: boolean;
}
