import { PropType } from '../../../../shared/enums/prop-type.enum'

import { BaseEntity } from '../../core-entities/base-entity'
import { Entity } from '../../crud/decorators/entity.decorator'
import { Prop } from '../../crud/decorators/prop.decorator'

@Entity()
export class Team extends BaseEntity {
  @Prop({
    label: 'name',
    type: PropType.Text,
    seed: (index?: number) => `Team ${index}`
  })
  name: string
}
