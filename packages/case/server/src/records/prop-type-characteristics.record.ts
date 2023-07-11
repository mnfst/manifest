import { faker } from '@faker-js/faker'
import { ColumnType } from 'typeorm/driver/types/ColumnTypes'
import { PropType } from '../../../shared/enums/prop-type.enum'

export type PropTypeCharacteristics = {
  columnType: ColumnType
  defaultSeedFunction: (index?: number, relationSeedCount?: number) => any
}

export const propTypeCharacteristicsRecord: Record<
  PropType,
  PropTypeCharacteristics
> = {
  [PropType.Text]: {
    columnType: 'varchar',
    defaultSeedFunction: () => faker.commerce.product()
  },
  [PropType.Number]: {
    columnType: 'decimal',
    defaultSeedFunction: (index: number) => faker.number.int({ max: 50 })
  },
  [PropType.Relation]: {
    columnType: 'int',
    defaultSeedFunction: (_index: number, relationSeedCount: number) =>
      faker.number.int({ min: 1, max: relationSeedCount })
  },

  [PropType.TextArea]: {
    columnType: 'text',
    defaultSeedFunction: () => faker.commerce.productDescription()
  },

  [PropType.Currency]: {
    columnType: 'decimal',
    defaultSeedFunction: (index: number) => faker.finance.amount(index, 500, 2)
  },
  [PropType.Date]: {
    columnType: 'date',
    defaultSeedFunction: () => faker.date.past()
  },
  [PropType.Email]: {
    columnType: 'varchar',
    defaultSeedFunction: (index: number) => faker.internet.email()
  },
  [PropType.Boolean]: {
    columnType: 'boolean',
    defaultSeedFunction: (index: number) => faker.datatype.boolean()
  },
  [PropType.Password]: {
    columnType: 'varchar',
    defaultSeedFunction: () =>
      faker.internet.password({
        length: 10,
        memorable: true
      })
  }
}
