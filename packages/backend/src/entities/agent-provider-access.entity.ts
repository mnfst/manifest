import { Entity, PrimaryColumn } from 'typeorm';

@Entity('agent_provider_access')
export class AgentProviderAccess {
  @PrimaryColumn('varchar')
  agent_id!: string;

  @PrimaryColumn('varchar')
  user_provider_id!: string;
}
