import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Agent } from './agent.entity';

/**
 * Per-agent activation of request healing. Presence of a row means healing is
 * enabled for that agent; no row means disabled. Mirrors the
 * `agent_enabled_providers` junction (toggled in the UI), minus the provider
 * dimension since healing is a single feature.
 */
@Entity('agent_healing_enabled')
export class AgentHealingEnabled {
  @PrimaryColumn('varchar')
  agent_id!: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;
}
