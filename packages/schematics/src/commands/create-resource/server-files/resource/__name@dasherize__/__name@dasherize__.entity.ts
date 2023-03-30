import { CaseProperty } from '@casejs/nest-library'
import { faker } from '@faker-js/faker'
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm'

@Entity({ name: '<%= camelize(name) %>s' })
export class <%= classify(name) %> {
  public static searchableFields: string[] = ['id']
  public static displayName: string = 'id'

  @PrimaryGeneratedColumn()
  id: number

  @CreateDateColumn({ select: false })
  createdAt: Date

  @UpdateDateColumn({ select: false })
  updatedAt: Date
}
