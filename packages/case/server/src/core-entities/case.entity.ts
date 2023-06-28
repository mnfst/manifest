import { PrimaryGeneratedColumn } from 'typeorm'

export class CaseEntity {
  @PrimaryGeneratedColumn()
  id: number
}
