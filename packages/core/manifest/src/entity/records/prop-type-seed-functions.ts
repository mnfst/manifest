import { faker } from '@faker-js/faker'
import { SHA3 } from 'crypto-js'

import { PropType } from '@casejs/types'

export const propTypeSeedFunctions: Record<PropType, () => any> = {
  [PropType.String]: () => faker.commerce.product(),
  [PropType.Number]: () => faker.number.int({ max: 50 }),
  [PropType.Link]: () => 'https://manifest.build',
  [PropType.Text]: () => faker.commerce.productDescription(),
  [PropType.Money]: () => faker.finance.amount(1, 500, 2),
  [PropType.Date]: () => faker.date.past(),
  [PropType.Email]: () => faker.internet.email(),
  [PropType.Boolean]: () => faker.datatype.boolean(),
  [PropType.Password]: () => SHA3('manifest').toString(),
  [PropType.Choice]: () => null,
  [PropType.Location]: () => ({
    lat: faker.location.latitude(),
    lng: faker.location.longitude()
  })
}
