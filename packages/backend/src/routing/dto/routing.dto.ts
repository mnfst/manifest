import {
  IsString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  Matches,
} from 'class-validator';

const VALID_TIERS = ['simple', 'standard', 'complex', 'reasoning'] as const;
const VALID_AUTH_TYPES = ['api_key', 'subscription'] as const;

export class AgentNameParamDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid agent name' })
  agentName!: string;
}

export class TierParamDto {
  @IsIn(VALID_TIERS)
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
  provider!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsIn(VALID_AUTH_TYPES)
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
  @IsIn(VALID_AUTH_TYPES)
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
  @IsIn(VALID_AUTH_TYPES)
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
