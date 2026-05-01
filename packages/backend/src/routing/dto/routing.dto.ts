import {
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
import { AGENT_NAME_MESSAGE, AGENT_NAME_PATTERN } from '../../common/constants/agent-name';

const KNOWN_PROVIDER_IDS: readonly string[] = Array.from(PROVIDER_BY_ID_OR_ALIAS.keys());

export class AgentNameParamDto {
  @IsString()
  @IsNotEmpty()
  @Matches(AGENT_NAME_PATTERN, { message: AGENT_NAME_MESSAGE })
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
  @Matches(AGENT_NAME_PATTERN, { message: AGENT_NAME_MESSAGE })
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
  authType?: 'api_key' | 'subscription';
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
}
