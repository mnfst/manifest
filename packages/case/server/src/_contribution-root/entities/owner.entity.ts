import { type } from 'os'
import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'

@Entity({
  nameSingular: 'owner',
  namePlural: 'owners',
  propIdentifier: 'name',
  slug: 'owners',
  seedCount: 5
})
export class Owner extends CaseEntity {
  @Prop({})
  name: string

  @Prop({
    type: PropType.Currency,
    options: {
      currency: 'EUR'
    }
  })
  wealth: number

  @Prop({
    label: 'Is the user active ?',
    type: PropType.Boolean
  })
  isActive: boolean
}
