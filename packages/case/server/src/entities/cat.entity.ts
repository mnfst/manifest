import { faker } from '@faker-js/faker'

import { PropType } from '../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../core-entities/case.entity'
import { Prop } from '../decorators/case-prop.decorator'
import { Entity } from '../decorators/entity.decorator'
import { Owner } from './owner.entity'

@Entity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cat',
  seedCount: 50,
  propIdentifier: 'name'
})
export class Cat extends CaseEntity {
  @Prop({
    seed: () => faker.person.firstName()
  })
  name: string

  @Prop({
    type: PropType.Number
  })
  age: number

  @Prop({
    type: PropType.Relation,
    filter: true,
    options: {
      entity: Owner
    }
  })
  owner: Owner

  @Prop({
    type: PropType.Email
  })
  email: string

  @Prop({
    type: PropType.Date
  })
  birthdate: Date

  @Prop({
    type: PropType.TextArea
  })
  description: string

  @Prop({
    type: PropType.Currency
  })
  price: number

  @Prop({
    type: PropType.Boolean
  })
  adopted: boolean
}
