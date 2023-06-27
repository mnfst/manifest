import { faker } from '@faker-js/faker'
import { PrimaryGeneratedColumn } from 'typeorm'
import { PropType } from '~shared/enums/prop-type.enum'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { Owner } from './owner.entity'

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
    seed: () => faker.person.firstName()
  })
  name: string

  @CaseProp({
    label: 'Age',
    type: PropType.Integer,
    seed: (index?: number) => index
  })
  age: number

  @CaseProp({
    label: 'Owner',
    type: PropType.Relation,
    settings: {
      entity: Owner
    }
  })
  owner: Owner
}
