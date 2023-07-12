import { PropType } from '../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../core-entities/case.entity'
import { Prop } from '../decorators/case-prop.decorator'
import { Entity } from '../decorators/entity.decorator'
import { Cat } from './cat.entity'

@Entity({
  nameSingular: 'mouse',
  namePlural: 'mouses',
  slug: 'mouses',
  propIdentifier: 'nickName'
})
export class Mouse extends CaseEntity {
  @Prop({
    label: 'Nickname',
    type: PropType.Text,
    seed: (index?: number) => `Mouse ${index}`
  })
  nickName: string

  @Prop({
    label: 'Family name',
    type: PropType.Text
  })
  familyName: string

  @Prop({
    label: 'Predator',
    type: PropType.Relation,
    options: {
      entity: Cat
    }
  })
  predator: Cat
}
