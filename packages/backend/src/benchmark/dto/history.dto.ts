import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';
import { AGENT_NAME_MESSAGE, AGENT_NAME_PATTERN } from '../../common/constants/agent-name';

export class ListHistoryQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(AGENT_NAME_PATTERN, { message: AGENT_NAME_MESSAGE })
  agentName!: string;
}

export class RunIdParamDto {
  @IsUUID()
  runId!: string;
}
