import { faker } from '@faker-js/faker'
import { PrimaryGeneratedColumn } from 'typeorm'
import { PropType } from '~shared/enums/prop-type.enum'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { Owner } from './owner.entity'
import { type } from 'os'

@CaseEntity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cat',
  seedCount: 50,
  propIdentifier: 'name'
})
export class Cat {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({
    seed: () => faker.person.firstName(),
    type: PropType.String
  })
  name: string

  @CaseProp({
    seed: () => faker.lorem.sentences(),
    type: PropType.Text
  })
  description: string

  @CaseProp({
    seed: () => faker.number.int({ min: 0, max: 1000 }),
    type: PropType.Currency
  })
  price: string

  @CaseProp({
    seed: () => faker.datatype.boolean(),
    type: PropType.Boolean
  })
  adopted: string

  @CaseProp({
    label: 'Age',
    type: PropType.Number,
    seed: (index?: number) => index
  })
  age: number

  @CaseProp({
    label: 'Owner',
    type: PropType.Relation,
    options: {
      entity: Owner
    }
  })
  owner: Owner
}
