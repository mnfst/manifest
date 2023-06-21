import { PrimaryGeneratedColumn } from 'typeorm'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { PropType } from '~shared/enums/prop-type.enum'

@CaseEntity({
  nameSingular: 'mouse',
  namePlural: 'mouses',
  slug: 'mouse'
})
export class Mouse {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({
    name: 'Nickname',
    type: PropType.String,
    seed: (index?: number) => `Mouse ${index}`
  })
  nickName: string

  @CaseProp({
    name: 'Family name',
    type: PropType.String
  })
  familyName: string
}
