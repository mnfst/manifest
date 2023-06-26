import { PrimaryGeneratedColumn } from 'typeorm'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { PropType } from '~shared/enums/prop-type.enum'
import { Owner } from './owner.entity'

@CaseEntity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cat'
})
export class Cat {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({})
  name: string

  @CaseProp({
    name: 'Age',
    type: PropType.Integer,
    seed: (index?: number) => index
  })
  age: number

  @CaseProp({
    name: 'Owner',
    type: PropType.Relation,
    settings: {
      entity: Owner
    }
  })
  owner: Owner
}
