import { faker } from '@faker-js/faker'
import { SHA3 } from 'crypto-js'

import { PropType } from '@mnfst/types'

// This is a mapping of prop types to seed functions.
export const propTypeSeedFunctions: Record<PropType, (options?: any) => any> = {
  [PropType.String]: () => faker.commerce.product(),
  [PropType.Number]: () => faker.number.int({ max: 50 }),
  [PropType.Link]: () => 'https://manifest.build',
  [PropType.Text]: () => faker.commerce.productDescription(),
  [PropType.Money]: () =>
    faker.finance.amount({
      min: 1,
      max: 500,
      dec: 2
    }),
  [PropType.Date]: () => faker.date.past(),
  [PropType.Timestamp]: () => faker.date.recent(),
  [PropType.Email]: () => faker.internet.email(),
  [PropType.Boolean]: () => faker.datatype.boolean(),
  [PropType.Password]: () => SHA3('manifest').toString(),
  [PropType.Choice]: (options: { values: string[] }) =>
    faker.helpers.arrayElement(options.values),
  [PropType.Location]: () => ({
    lat: faker.location.latitude(),
    lng: faker.location.longitude()
  })
}
