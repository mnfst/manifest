import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AUTH_TYPES } from 'manifest-shared';

export class BenchmarkMessageDto {
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  content!: string;
}

export class RunBenchmarkDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid agent name' })
  agentName!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: 'api_key' | 'subscription';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BenchmarkMessageDto)
  messages!: BenchmarkMessageDto[];

  /**
   * Client-generated identifier linking every column of the same UI submit
   * into one benchmark_runs row. Optional — when omitted a standalone run
   * record is created. When provided, reused if the run already exists.
   */
  @IsOptional()
  @IsUUID()
  runId?: string;

  /**
   * 0-indexed position of this column within its run, used to preserve
   * column order on replay.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  position?: number;

  /**
   * Extra HTTP headers to attach to the outgoing provider request.
   * Sanitized server-side — Manifest-managed and transport-layer headers
   * are silently dropped.
   */
  @IsOptional()
  @IsObject()
  requestHeaders?: Record<string, string>;
}
