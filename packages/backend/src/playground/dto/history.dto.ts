import { IsNotEmpty, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';

export class ListHistoryQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid agent name' })
  agentName!: string;
}

export class RunIdParamDto {
  @IsUUID()
  runId!: string;
}

export class SetBestColumnDto {
  // `null` clears the pick (toggle off); a uuid sets the best column.
  // ValidateIf skips the IsUUID check only when the client explicitly sends
  // null, so an absent/garbage value still fails validation.
  @ValidateIf((o: SetBestColumnDto) => o.columnId !== null)
  @IsUUID()
  columnId!: string | null;
}
