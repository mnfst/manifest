import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'

/**
 * Owner entity that extends CaseEntity.
 */
@Entity({
  nameSingular: 'owner',
  namePlural: 'owners',
  propIdentifier: 'name',
  slug: 'owners',
  seedCount: 5
})
export class Owner extends CaseEntity {
  
  /**
   * Name of the owner.
   */
  @Prop({})
  name: string

  /**
   * Wealth of the owner in EUR.
   */
  @Prop({
    type: PropType.Currency,
    options: {
      currency: 'EUR'
    }
  })
  wealth: number

  
  /**
   * Activity status of the owner.
   */
  @Prop({
    label: 'Is the user active ?',
    type: PropType.Boolean
  })
  isActive: boolean
}
