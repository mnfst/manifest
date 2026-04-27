import {
  IsBoolean,
  IsString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { TIER_SLOTS, AUTH_TYPES } from 'manifest-shared';
import { PROVIDER_BY_ID_OR_ALIAS } from '../../common/constants/providers';

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

  /** Label for multi-account disambiguation (e.g. "work", "personal"). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  accountLabel?: string;
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

  /** Specific UserProvider.id to remove (multi-account). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  providerId?: string;
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
  authType?: 'api_key' | 'subscription';

  /** Exact UserProvider.id — preferred over provider/authType for multi-account. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  overrideProviderId?: string;
}

export class CopilotPollDto {
  @IsString()
  @IsNotEmpty()
  deviceCode!: string;

  /** Label for multi-account disambiguation when creating a new account. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  accountLabel?: string;
}

export class PatchProviderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  accountLabel?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ProviderIdParamDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid agent name' })
  agentName!: string;

  @IsString()
  @IsNotEmpty()
  providerId!: string;
}

export class SetFallbacksDto {
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  models!: string[];
}
