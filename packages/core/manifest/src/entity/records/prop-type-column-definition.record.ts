import { faker } from '@faker-js/faker'
import { SHA3 } from 'crypto-js'
import { ColumnType } from 'typeorm/driver/types/ColumnTypes'

import { PropType } from '@casejs/types'

export type ColumnDefinition = {
  columnType: ColumnType
  defaultSeedFunction: (index?: number, relationSeedCount?: number) => any
}

export const propTypeCharacteristicsRecord: Record<PropType, ColumnDefinition> =
  {
    [PropType.String]: {
      columnType: 'varchar',
      defaultSeedFunction: () => faker.commerce.product()
    },
    [PropType.Number]: {
      columnType: 'decimal',
      defaultSeedFunction: () => faker.number.int({ max: 50 })
    },
    [PropType.Link]: {
      columnType: 'varchar',
      defaultSeedFunction: () => 'https://manifest.build'
    },
    [PropType.Text]: {
      columnType: 'text',
      defaultSeedFunction: () => faker.commerce.productDescription()
    },
    [PropType.Money]: {
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
      defaultSeedFunction: () => SHA3('case').toString()
    },
    [PropType.Choice]: {
      columnType: 'simple-enum',
      defaultSeedFunction: () => null
    },
    [PropType.Location]: {
      columnType: 'json',
      defaultSeedFunction: () => ({
        lat: faker.location.latitude(),
        lng: faker.location.longitude()
      })
    }
  }
