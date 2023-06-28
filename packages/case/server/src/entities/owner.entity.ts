import { faker } from '@faker-js/faker'
import { PrimaryGeneratedColumn } from 'typeorm'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'

@CaseEntity({
  nameSingular: 'owner',
  namePlural: 'owners',
  propIdentifier: 'name',
  slug: 'owner',
  seedCount: 5
})
export class Owner {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({
    seed: () => faker.person.firstName()
  })
  name: string
}
