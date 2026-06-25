import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { RESPONSE_MODES, type ResponseMode } from 'manifest-shared';
import {
  EXPOSED_MODEL_SOURCE_KINDS,
  type ExposedModelSourceKind,
} from '../../entities/exposed-model-route.entity';
import { ModelRouteDto } from '../dto/routing.dto';

export const MAX_MODEL_ALIAS_ID_LENGTH = 160;
export const MAX_MODEL_ALIAS_DISPLAY_NAME_LENGTH = 120;

export class CreateModelAliasDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MODEL_ALIAS_ID_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  model_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_MODEL_ALIAS_DISPLAY_NAME_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  display_name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsIn(EXPOSED_MODEL_SOURCE_KINDS)
  source_kind!: ExposedModelSourceKind;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  source_key?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelRouteDto)
  route?: ModelRouteDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ModelRouteDto)
  fallback_routes?: ModelRouteDto[];

  @IsOptional()
  @IsObject()
  request_params?: Record<string, unknown>;

  @IsOptional()
  @IsIn(RESPONSE_MODES)
  response_mode?: ResponseMode;
}

export class UpdateModelAliasDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MODEL_ALIAS_ID_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  model_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_MODEL_ALIAS_DISPLAY_NAME_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  display_name?: string | null;

  @IsOptional()
  @IsIn(EXPOSED_MODEL_SOURCE_KINDS)
  source_kind?: ExposedModelSourceKind;

  @IsOptional()
  @IsString()
  source_key?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelRouteDto)
  route?: ModelRouteDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ModelRouteDto)
  fallback_routes?: ModelRouteDto[] | null;

  @IsOptional()
  @IsObject()
  request_params?: Record<string, unknown> | null;

  @IsOptional()
  @IsIn(RESPONSE_MODES)
  response_mode?: ResponseMode;
}

export class SetModelAliasEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}
