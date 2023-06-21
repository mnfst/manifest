import { PrimaryGeneratedColumn } from 'typeorm'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { PropType } from '../dynamic-entity/prop-types/prop-type.enum'

@CaseEntity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cat'
})
export class Cat {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({
    type: PropType.String,
    seed: (index?: number) => index
  })
  name: string

  @CaseProp({
    type: PropType.Integer,
    seed: (index?: number) => index
  })
  age: number
}
