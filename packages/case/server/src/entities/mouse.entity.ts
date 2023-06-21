import { PrimaryGeneratedColumn } from 'typeorm'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { PropType } from '../dynamic-entity/prop-types/prop-type.enum'

@CaseEntity({
  nameSingular: 'mouse',
  namePlural: 'mouses',
  slug: 'mouse'
})
export class Mouse {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({
    type: PropType.String,
    seed: (index?: number) => index
  })
  nickName: string
}
