import { PrimaryGeneratedColumn } from 'typeorm'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { PropType } from '~shared/enums/prop-type.enum'
import { Owner } from './owner.entity'

@CaseEntity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cat',
  seedCount: 50
})
export class Cat {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({})
  name: string

  @CaseProp({
    label: 'Age',
    type: PropType.Number,
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
