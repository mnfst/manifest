import { PrimaryGeneratedColumn } from 'typeorm'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'

@CaseEntity({
  nameSingular: 'user',
  namePlural: 'users',
  slug: 'user'
})
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp()
  name: string

  @CaseProp()
  familyName: string
}
