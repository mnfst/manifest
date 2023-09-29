import { PrimaryGeneratedColumn } from 'typeorm'

/**
 * Base entity class
 * @class CaseEntity
 */
export class CaseEntity {
  /**
   * Primary key column
   */
  @PrimaryGeneratedColumn()
  id: number
}
