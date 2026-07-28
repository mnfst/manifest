import { Column, Entity, PrimaryColumn } from 'typeorm';
import { timestampType } from '../common/utils/postgres-sql';

/**
 * Singleton credential issued by Phoenix for self-hosted Autofix calls.
 * The secret is always encrypted before it reaches this entity.
 */
@Entity('instance_credential')
export class InstanceCredential {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  instance_id!: string;

  @Column('text')
  secret_encrypted!: string;

  @Column(timestampType())
  registered_at!: string;

  @Column('smallint', { default: 1 })
  schema_version!: number;
}
