import { faker } from '@faker-js/faker'
import { ColumnType } from 'typeorm/driver/types/ColumnTypes'
import { PropType } from '~shared/enums/prop-type.enum'

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
    columnType: 'mediumint',
    defaultSeedFunction: (index: number) => index
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
    columnType: 'mediumint',
    defaultSeedFunction: (index: number) => Math.random() * index
  },
  [PropType.Date]: {
    columnType: 'date',
    defaultSeedFunction: () => faker.date.past()
  },
  [PropType.Email]: {
    columnType: 'text',
    defaultSeedFunction: (index: number) => faker.internet.email()
  },
  [PropType.Boolean]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  }
}
