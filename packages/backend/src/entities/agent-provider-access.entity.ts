import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Agent } from './agent.entity';
import { UserProvider } from './user-provider.entity';

@Entity('agent_provider_access')
export class AgentProviderAccess {
  @PrimaryColumn('varchar')
  agent_id!: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @PrimaryColumn('varchar')
  user_provider_id!: string;

  @ManyToOne(() => UserProvider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_provider_id' })
  userProvider!: UserProvider;
}
