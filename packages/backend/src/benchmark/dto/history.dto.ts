import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

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
