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
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AUTH_TYPES } from 'manifest-shared';

export class PlaygroundMessageDto {
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  content!: string;
}

/**
 * Constraint asserting exactly one of `messages` / `rawRequestBody` is set.
 *
 * `messages` is the chat-completions shape Manifest builds itself; replay
 * (future) ships `rawRequestBody`, the verbatim recorded payload. Allowing
 * both at once is ambiguous (which one wins?); allowing neither is a
 * silent no-op upstream. Exactly-one is the only safe contract.
 */
@ValidatorConstraint({ name: 'PlaygroundPayloadShape', async: false })
export class PlaygroundPayloadShapeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { messages?: unknown; rawRequestBody?: unknown };
    const hasMessages = Array.isArray(obj.messages) && obj.messages.length > 0;
    const hasRaw =
      obj.rawRequestBody != null &&
      typeof obj.rawRequestBody === 'object' &&
      !Array.isArray(obj.rawRequestBody);
    return hasMessages !== hasRaw; // XOR
  }

  defaultMessage(): string {
    return 'exactly one of `messages` or `rawRequestBody` must be provided';
  }
}

export class RunPlaygroundDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid agent name' })
  // The XOR shape check is attached here (a non-optional field) rather than
  // to `messages` or `rawRequestBody`, because @IsOptional() on those fields
  // short-circuits @Validate when the field is undefined — letting a payload
  // with neither set (or both set) slip past the DTO. Agent name is always
  // present, so the validator always runs. The message text makes it clear
  // the violation is about the payload shape, not the agent name.
  @Validate(PlaygroundPayloadShapeConstraint)
  agentName!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: 'api_key' | 'subscription' | 'local';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PlaygroundMessageDto)
  messages?: PlaygroundMessageDto[];

  /**
   * Verbatim recorded request body, replayed as-is. Optional today —
   * the future "replay a recorded query" flow will set this and leave
   * `messages` empty. Validated only for size and basic shape; the
   * provider client treats it as an opaque JSON object.
   */
  @IsOptional()
  @IsObject()
  rawRequestBody?: Record<string, unknown>;

  /**
   * Client-generated identifier linking every column of the same UI submit
   * into one playground_runs row. Optional — when omitted a standalone run
   * record is created. When provided, reused if the run already exists.
   */
  @IsOptional()
  @IsUUID()
  runId?: string;

  /**
   * 0-indexed position of this column within its run, used to preserve
   * column order when rendering history.
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
