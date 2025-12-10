import { ValueTransformer } from 'typeorm'

/**
 * Number transformer for TypeORM.
 *
 * This transformer is used to convert string values to numbers as Postgres stores numbers as strings.
 */
export class NumberTransformer implements ValueTransformer {
  from(value: string | number): number {
    return Number(value)
  }

  to(value: string | number): string | number {
    return value
  }
}
