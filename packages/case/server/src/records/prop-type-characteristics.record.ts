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
    defaultSeedFunction: () => faker.number.int({ max: 50 })
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
    defaultSeedFunction: () => faker.finance.amount(1, 500, 2)
  },
  [PropType.Date]: {
    columnType: 'date',
    defaultSeedFunction: () => faker.date.past()
  },
  [PropType.Email]: {
    columnType: 'varchar',
    defaultSeedFunction: () => faker.internet.email()
  },
  [PropType.Boolean]: {
    columnType: 'boolean',
    defaultSeedFunction: () => faker.datatype.boolean()
  },
  [PropType.Password]: {
    columnType: 'varchar',
    defaultSeedFunction: () =>
      faker.internet.password({
        length: 10,
        memorable: true
      })
  },
  [PropType.File]: {
    columnType: 'varchar',
    defaultSeedFunction: () => '/dummy/dummy-document.xlsx'
  },
  [PropType.Image]: {
    columnType: 'varchar',
    defaultSeedFunction: () => '/dummy/dummy-image'
  }
}
