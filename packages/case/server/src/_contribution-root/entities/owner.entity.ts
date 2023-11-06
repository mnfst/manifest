import { IsBoolean, IsEmail, IsNotEmpty, Min } from 'class-validator'
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
  @Prop()
  name: string

  @Prop({
    type: PropType.Email,
    validators: [IsNotEmpty(), IsEmail()]
  })
  email: string

  @Prop({
    type: PropType.Currency,
    validators: [IsNotEmpty(), Min(1000)],
    options: {
      currency: 'EUR'
    }
  })
  wealth: number

  @Prop({
    label: 'Is the user active ?',
    validators: [IsBoolean()],
    type: PropType.Boolean
  })
  isActive: boolean
}
