import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';

import { AUTH_TYPES, type AuthType, type RequestParamDefaults } from 'manifest-shared';

/**
 * Param keys and value shapes are validated by the registry-aware controller
 * gate. The DTO only keeps the top-level object intact so whitelist mode
 * does not strip arbitrary future param keys before the registry sees them.
 */
export class ModelParamsBodyDto {
  @IsObject()
  params!: RequestParamDefaults;
}

export class SetModelParamsBodyDto extends ModelParamsBodyDto {
  @IsString()
  @IsNotEmpty()
  scope!: string;

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
  declare params: RequestParamDefaults;
}

export class DeleteModelParamsBodyDto {
  @IsString()
  @IsNotEmpty()
  scope!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsIn(AUTH_TYPES)
  authType!: AuthType;

  @IsString()
  @IsNotEmpty()
  model!: string;
}
