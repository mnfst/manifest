import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean } from 'class-validator';
import { AUTH_TYPES } from 'manifest-shared';

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

  /** Exact UserProvider.id — preferred over provider/authType for multi-account. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  overrideProviderId?: string;
}

export class ToggleSpecificityDto {
  @IsBoolean()
  active!: boolean;
}
