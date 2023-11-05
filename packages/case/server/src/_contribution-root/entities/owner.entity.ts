import { PropType } from '../../../../shared/enums/prop-type.enum'
import { BaseEntity } from '../../core-entities/base-entity'
import { Entity } from '../../crud/decorators/entity.decorator'
import { Prop } from '../../crud/decorators/prop.decorator'

@Entity({
  nameSingular: 'owner',
  namePlural: 'owners',
  propIdentifier: 'name',
  slug: 'owners',
  seedCount: 5
})
export class Owner extends BaseEntity {
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
