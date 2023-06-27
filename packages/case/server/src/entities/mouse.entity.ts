import { PrimaryGeneratedColumn } from 'typeorm'
import { PropType } from '~shared/enums/prop-type.enum'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'

@CaseEntity({
  nameSingular: 'mouse',
  namePlural: 'mouses',
  slug: 'mouse',
  propIdentifier: 'nickName'
})
export class Mouse {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({
    label: 'Nickname',
    type: PropType.String,
    seed: (index?: number) => `Mouse ${index}`
  })
  nickName: string

  @CaseProp({
    label: 'Family name',
    type: PropType.String
  })
  familyName: string
}
