import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';

import { AUTH_TYPES, type AuthType, type RequestParamDefaults } from 'manifest-shared';

export type ModelParamsBodyDto = RequestParamDefaults;

export class SetModelParamsBodyDto {
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
  @IsObject()
  params!: RequestParamDefaults;
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
