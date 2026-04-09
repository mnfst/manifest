import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean } from 'class-validator';
import { AUTH_TYPES, SPECIFICITY_CATEGORIES } from 'manifest-shared';

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
}

export class ToggleSpecificityDto {
  @IsBoolean()
  active!: boolean;
}

export class SpecificityParamDto {
  @IsIn(SPECIFICITY_CATEGORIES as readonly string[])
  category!: string;
}
