import {
  IsString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { TIER_SLOTS, AUTH_TYPES } from 'manifest-shared';
import { PROVIDER_BY_ID_OR_ALIAS } from '../../common/constants/providers';

export class ModelRouteDto {
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsIn(AUTH_TYPES)
  authType!: 'api_key' | 'subscription' | 'local';

  @IsString()
  @IsNotEmpty()
  model!: string;
}

const KNOWN_PROVIDER_IDS: readonly string[] = Array.from(PROVIDER_BY_ID_OR_ALIAS.keys());

export class AgentNameParamDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid agent name' })
  agentName!: string;
}

export class TierParamDto {
  @IsIn(TIER_SLOTS)
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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(KNOWN_PROVIDER_IDS, {
    message: `provider must be one of: ${KNOWN_PROVIDER_IDS.join(', ')}`,
  })
  provider!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: 'api_key' | 'subscription';

  @IsOptional()
  @IsString()
  region?: string;
}

export class AgentProviderParamDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid agent name' })
  agentName!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;
}

export class RemoveProviderQueryDto {
  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: 'api_key' | 'subscription';
}

export class SetOverrideDto {
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

  // Optional route field. When clients send this, it takes precedence over
  // the flat (model, provider, authType) above and is the unambiguous shape.
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelRouteDto)
  route?: ModelRouteDto;
}

/**
 * Body for PATCH `…/tiers/:tier/params` and `…/specificity/:category/params`.
 * `paramDefaults: null` clears the configured defaults; an object replaces
 * them wholesale. Validation only checks shape; we don't lock the field set
 * because new provider knobs (reasoning_effort, safety, etc.) shouldn't
 * require a backend release.
 */
export class SetParamDefaultsDto {
  @IsOptional()
  @IsObject()
  paramDefaults?: Record<string, unknown> | null;
}

export class CopilotPollDto {
  @IsString()
  @IsNotEmpty()
  deviceCode!: string;
}

export class SetFallbacksDto {
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  models!: string[];

  // Optional structured routes. When present, takes precedence over `models`
  // above and is what we persist to fallback_routes. Length must match
  // `models` so the dual-write stays consistent.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ModelRouteDto)
  routes?: ModelRouteDto[];
}
