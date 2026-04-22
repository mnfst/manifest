import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

@Entity('notification_rules')
@Index(['tenant_id', 'agent_id'])
@Index(['user_id', 'agent_name'])
@Index(['tenant_id', 'agent_name'])
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

  @Column('varchar', { default: 'notify' })
  action!: 'notify' | 'block' | 'both';

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
