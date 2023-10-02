import { PrimaryGeneratedColumn } from 'typeorm'

export class CaseEntity {
  @PrimaryGeneratedColumn()
  id: number

  _relations?: { [key: string]: any }
}
