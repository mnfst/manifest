import { ValueTransformer } from 'typeorm'
import { DatabaseConnection } from '../../../../types/src'

/**
 * Boolean transformer for TypeORM.
 *
 * This transformer is used to convert boolean values to numbers for MySQL as it returns 1 for true and 0 for false.
 */
export class BooleanTransformer implements ValueTransformer {
  private connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  to(value: boolean): number | boolean {
    if (this.connection === 'mysql') {
      return value ? 1 : 0
    }
    return value
  }

  from(value: number | boolean): boolean {
    if (this.connection === 'mysql') {
      return value === 1
    }
    return value as boolean
  }
}
