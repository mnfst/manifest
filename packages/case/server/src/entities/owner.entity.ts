import { faker } from '@faker-js/faker'

import { CaseEntity } from '../core-entities/case.entity'
import { Prop } from '../decorators/case-prop.decorator'
import { Entity } from '../decorators/entity.decorator'

@Entity({
  nameSingular: 'owner',
  namePlural: 'owners',
  propIdentifier: 'name',
  slug: 'owner',
  seedCount: 5
})
export class Owner extends CaseEntity {
  @Prop({
    seed: () => faker.person.firstName()
  })
  name: string
}
