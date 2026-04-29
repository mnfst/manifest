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
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AUTH_TYPES } from 'manifest-shared';
import { AGENT_NAME_MESSAGE, AGENT_NAME_PATTERN } from '../../common/constants/agent-name';

/**
 * Hard cap on the serialized size of `rawRequestBody`. Aligned with the
 * Express body-parser limit (`1mb` in `main.ts`) so a recording that the
 * proxy successfully captured can always be re-shipped through replay.
 */
export const RAW_REQUEST_BODY_MAX_BYTES = 1024 * 1024;

@ValidatorConstraint({ name: 'rawRequestBodySize', async: false })
export class RawRequestBodySizeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'object') return false;
    try {
      const serialized = JSON.stringify(value);
      return Buffer.byteLength(serialized, 'utf8') <= RAW_REQUEST_BODY_MAX_BYTES;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return `rawRequestBody exceeds ${RAW_REQUEST_BODY_MAX_BYTES} bytes`;
  }
}

/** Max nesting depth before we treat the payload as hostile/malformed. */
export const RAW_REQUEST_BODY_MAX_DEPTH = 8;

@ValidatorConstraint({ name: 'rawRequestBodyShape', async: false })
export class RawRequestBodyShapeConstraint implements ValidatorConstraintInterface {
  private failureReason = 'invalid';

  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'object' || Array.isArray(value)) {
      this.failureReason = 'must be a JSON object';
      return false;
    }
    const obj = value as Record<string, unknown>;
    // Replay only makes sense for chat-shaped bodies. Reject anything that
    // doesn't carry a `messages` array — that's the only contract the
    // benchmark forwarder honors today, and silently shipping a malformed
    // body wastes a provider call.
    if (!Array.isArray(obj.messages)) {
      this.failureReason = 'missing messages array';
      return false;
    }
    // Walk the tree and reject internal/prototype-poisoning keys + over-deep
    // nesting. Internal-only side channels (e.g. `_extractedSignatures`,
    // `_extractedThinkingBlocks`) and `__proto__`/`constructor` should never
    // come in from the client.
    if (!this.walk(value, 0)) return false;
    return true;
  }

  private walk(node: unknown, depth: number): boolean {
    if (depth > RAW_REQUEST_BODY_MAX_DEPTH) {
      this.failureReason = `nested deeper than ${RAW_REQUEST_BODY_MAX_DEPTH}`;
      return false;
    }
    if (Array.isArray(node)) {
      for (const v of node) {
        if (!this.walk(v, depth + 1)) return false;
      }
      return true;
    }
    if (node !== null && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        if (
          key.startsWith('_') ||
          key.startsWith('$') ||
          key === '__proto__' ||
          key === 'constructor' ||
          key === 'prototype'
        ) {
          this.failureReason = `forbidden key "${key}"`;
          return false;
        }
        if (!this.walk((node as Record<string, unknown>)[key], depth + 1)) return false;
      }
    }
    return true;
  }

  defaultMessage(): string {
    return `rawRequestBody ${this.failureReason}`;
  }
}

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
  @Matches(AGENT_NAME_PATTERN, { message: AGENT_NAME_MESSAGE })
  agentName!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsString()
  @IsNotEmpty()
  // Custom providers (`custom:<uuid>`) need a `customEndpoint` resolved from
  // CustomProviderService — wiring that into BenchmarkService is followup
  // work tracked in the audit. Reject explicitly so the user sees a clear
  // 400 instead of a TypeError leaked from `endpoint.format`.
  @Matches(/^(?!custom:)/i, { message: 'Custom providers are not supported in benchmark yet' })
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

  /**
   * Optional full request body captured from a recorded message. When
   * present the server forwards this verbatim (minus `stream`) instead of
   * synthesizing `{ messages }` from `dto.messages`. Used for the
   * "replay a recorded query" flow so the target models receive the exact
   * same tools/temperature/etc. as the original run.
   */
  @IsOptional()
  @IsObject()
  @Validate(RawRequestBodySizeConstraint)
  @Validate(RawRequestBodyShapeConstraint)
  rawRequestBody?: Record<string, unknown>;
}
