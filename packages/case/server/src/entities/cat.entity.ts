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
    label: 'Age',
    type: PropType.Number,
    seed: (index?: number) => index
  })
  age: number

  @Prop({
    label: 'Owner',
    type: PropType.Relation,
    options: {
      entity: Owner
    }
  })
  owner: Owner
}
