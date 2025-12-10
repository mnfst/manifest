import { ValueTransformer } from 'typeorm'

/**
 * Timestamp transformer for TypeORM.
 *
 * This transformer is used to convert Date objects to ISO strings (SQLite returns Date objects by default).
 */
export class TimestampTransformer implements ValueTransformer {
  from(value: Date | string) {
    return value instanceof Date ? value.toISOString() : value
  }

  to(value: string) {
    return value
  }
}
