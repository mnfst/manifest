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
  seedCount: 5,
  propIdentifier: 'name'
})
export class Cat extends CaseEntity {
  @Prop({
    seed: () => faker.person.firstName()
  })
  name: string

  @Prop({
    label: 'Age',
    type: PropType.Number,
    seed: (index?: number) => index
  })
  age: number

  @Prop({
    label: 'Owner',
    type: PropType.Relation,
    filter: true,
    options: {
      entity: Owner
    }
  })
  owner: Owner

  @Prop({
    label: 'Email',
    type: PropType.Email,
    seed: () => faker.internet.email()
  })
  email: string

  @Prop({
    label: 'Birthdate',
    type: PropType.Date,
    seed: () => faker.date.past()
  })
  birthdate: Date

  @Prop({
    seed: () => faker.lorem.sentences(),
    type: PropType.TextArea
  })
  description: string

  @Prop({
    seed: () => faker.finance.amount(0, 500, 2),
    type: PropType.Currency
  })
  price: number

  @Prop({
    seed: () => faker.datatype.boolean(),
    type: PropType.Boolean
  })
  adopted: boolean
}
