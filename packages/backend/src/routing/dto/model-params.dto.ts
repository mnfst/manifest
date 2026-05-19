import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { AUTH_TYPES, type AuthType, type RequestParamDefaults } from 'manifest-shared';

/**
 * Subset of valid `RequestParamDefaults` keys this DTO understands today.
 * The shape is curated: when a new provider knob lands (`reasoning_effort`,
 * safety toggles, etc.), append the corresponding `ThinkingParamsDto`-style
 * nested class and a `@ValidateIf` clause to keep the JSONB schema honest.
 * Unknown keys are stripped by the global `ValidationPipe`'s `whitelist`,
 * so a curious client can't slip a free-form payload past the gate.
 */
export class ThinkingParamsDto {
  @IsIn(['enabled', 'disabled'])
  type!: 'enabled' | 'disabled';
}

export class ModelParamsBodyDto implements RequestParamDefaults {
  @IsOptional()
  @ValidateNested()
  @Type(() => ThinkingParamsDto)
  thinking?: ThinkingParamsDto;
}

export class SetModelParamsBodyDto {
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsIn(AUTH_TYPES)
  authType!: AuthType;

  @IsString()
  @IsNotEmpty()
  model!: string;

  // Always required on PUT — to clear params, call DELETE instead. Routing
  // through one path per intent keeps the storage model simple (no "save
  // empty == delete" magic at the controller layer).
  @IsObject()
  @ValidateNested()
  @Type(() => ModelParamsBodyDto)
  params!: ModelParamsBodyDto;
}

export class DeleteModelParamsBodyDto {
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsIn(AUTH_TYPES)
  authType!: AuthType;

  @IsString()
  @IsNotEmpty()
  model!: string;
}
