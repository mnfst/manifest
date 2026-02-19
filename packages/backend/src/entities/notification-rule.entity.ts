import {
  Entity,
  Column,
  PrimaryColumn,
  Index,
} from 'typeorm';

@Entity('notification_rules')
@Index(['tenant_id', 'agent_id'])
export class NotificationRule {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  tenant_id!: string;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar')
  agent_name!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  metric_type!: 'tokens' | 'cost';

  @Column('decimal', { precision: 15, scale: 6 })
  threshold!: number;

  @Column('varchar')
  period!: 'hour' | 'day' | 'week' | 'month';

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column('timestamp', { default: () => 'NOW()' })
  created_at!: string;

  @Column('timestamp', { default: () => 'NOW()' })
  updated_at!: string;
}
