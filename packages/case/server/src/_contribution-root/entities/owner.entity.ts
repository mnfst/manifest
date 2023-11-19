import { IsBoolean, IsEmail, IsNotEmpty, Min } from 'class-validator'
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

  @Prop({
    type: PropType.Email,
    validators: [IsNotEmpty(), IsEmail()]
  })
  email: string

  /**
  * Wealth of the owner in EUR.
  */
  @Prop({
    type: PropType.Currency,
    validators: [IsNotEmpty(), Min(1000)],
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
    validators: [IsBoolean()],
    type: PropType.Boolean
  })
  isActive: boolean
}
