import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Agent } from './agent.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { unique: true })
  name!: string;

  @Column('varchar', { nullable: true })
  organization_name!: string | null;

  @Column('varchar', { nullable: true })
  email!: string | null;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @OneToMany(() => Agent, (a) => a.tenant, { cascade: true })
  agents!: Agent[];

  @Column('timestamp', { default: () => 'NOW()' })
  created_at!: string;

  @Column('timestamp', { default: () => 'NOW()' })
  updated_at!: string;
}
