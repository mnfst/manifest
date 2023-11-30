import { PropType } from '../../../../shared/enums/prop-type.enum'

import { BaseEntity } from '../../core-entities/base-entity'
import { Entity } from '../../crud/decorators/entity.decorator'
import { Prop } from '../../crud/decorators/prop.decorator'
import { User } from './user.entity'

@Entity()
export class Team extends BaseEntity {
  @Prop({
    label: 'name',
    type: PropType.Text,
    seed: (index?: number) => `Team ${index}`
  })
  name: string

  @Prop({
    label: 'description',
    type: PropType.Text,
    seed: (index?: number) => `Description ${index}`,
    options: {
      isHidden: true
    }
  })
  hiddenTeamProp: string

  @Prop({
    label: 'Manager',
    type: PropType.Relation,
    options: {
      entity: User,
      eager: true
    }
  })
  manager: User
}
