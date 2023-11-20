import { faker } from '@faker-js/faker'
import { SHA3 } from 'crypto-js'
import { ColumnType } from 'typeorm/driver/types/ColumnTypes'

import { PropType } from '../../../../shared/enums/prop-type.enum'

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
  [PropType.Link]: {
    columnType: 'varchar',
    defaultSeedFunction: () => 'https://case.app'
  },
  [PropType.Relation]: {
    columnType: 'int',
    defaultSeedFunction: (_index: number, relationSeedCount: number) =>
      faker.number.int({ min: 1, max: relationSeedCount })
  },
  [PropType.Textarea]: {
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
    defaultSeedFunction: () => SHA3('case').toString()
  },
  [PropType.File]: {
    columnType: 'varchar',
    defaultSeedFunction: () => '/dummy/dummy-document.xlsx'
  },
  [PropType.Image]: {
    columnType: 'json',
    defaultSeedFunction: () => {
      const imageNumber: number = faker.number.int({ min: 1, max: 5 })
      return {
        thumbnail: `/dummy/dummy-image${imageNumber}-thumbnail.jpg`,
        large: `/dummy/dummy-image${imageNumber}-large.jpg`
      }
    }
  },
  [PropType.Enum]: {
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
