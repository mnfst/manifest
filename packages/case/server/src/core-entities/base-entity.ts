import { PrimaryGeneratedColumn } from 'typeorm'

// The base entity is used to extend all entities in the application.
export class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number

  _relations?: { [key: string]: any }
}
