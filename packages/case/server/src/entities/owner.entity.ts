import { PrimaryGeneratedColumn } from 'typeorm'

import { CaseEntity } from '../decorators/case-entity.decorator'
import { CaseProp } from '../decorators/case-prop.decorator'
import { PropType } from '~shared/enums/prop-type.enum'

@CaseEntity({
  nameSingular: 'owner',
  namePlural: 'owners',
  slug: 'owner',
  seedCount: 5
})
export class Owner {
  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({})
  name: string
}
