import {
  Entity,
  Column,
  PrimaryColumn,
  Index,
} from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('notification_logs')
@Index(['rule_id', 'period_start'], { unique: true })
export class NotificationLog {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  rule_id!: string;

  @Column(timestampType())
  period_start!: string;

  @Column(timestampType())
  period_end!: string;

  @Column('decimal', { precision: 15, scale: 6 })
  actual_value!: number;

  @Column('decimal', { precision: 15, scale: 6 })
  threshold_value!: number;

  @Column('varchar')
  metric_type!: string;

  @Column('varchar')
  agent_name!: string;

  @Column(timestampType(), { default: () => 'NOW()' })
  sent_at!: string;
}
