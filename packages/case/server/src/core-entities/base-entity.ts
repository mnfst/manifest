import { PrimaryGeneratedColumn } from 'typeorm'

export class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number

  _relations?: { [key: string]: any }
}
