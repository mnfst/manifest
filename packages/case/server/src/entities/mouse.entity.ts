import { PrimaryGeneratedColumn } from 'typeorm'
import { PropType } from '~shared/enums/prop-type.enum'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { Cat } from './cat.entity'

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
    type: PropType.Text,
    seed: (index?: number) => `Mouse ${index}`
  })
  nickName: string

  @CaseProp({
    label: 'Family name',
    type: PropType.Text
  })
  familyName: string

  @CaseProp({
    label: 'Predator',
    type: PropType.Relation,
    options: {
      entity: Cat
    }
  })
  predator: Cat
}
