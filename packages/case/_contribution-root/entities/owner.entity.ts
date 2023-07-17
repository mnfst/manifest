import { faker } from '../../server/node_modules/@faker-js/faker'

import { CaseEntity } from '../../server/src'
import { Entity } from '../../server/src/decorators/entity.decorator'
import { Prop } from '../../server/src/decorators/prop.decorator'
import { PropType } from '../../shared/enums/prop-type.enum'

@Entity({
  nameSingular: 'owner',
  namePlural: 'owners',
  propIdentifier: 'name',
  slug: 'owners',
  seedCount: 5
})
export class Owner extends CaseEntity {
  @Prop({
    seed: () => faker.person.firstName()
  })
  name: string

  @Prop({
    type: PropType.Currency,
    options: {
      currency: 'TBH'
    }
  })
  wealth: number
}
