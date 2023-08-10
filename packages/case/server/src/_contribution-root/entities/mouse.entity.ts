import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'
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
    type: PropType.File
  })
  certificate: string

  @Prop({
    type: PropType.Image
  })
  image: string

  @Prop({
    label: 'Choose a Predator',
    type: PropType.Relation,
    options: {
      entity: Cat
    }
  })
  predator: Cat

  @Prop({
    type: PropType.Password
  })
  password: string

  @Prop({
    type: PropType.Textarea
  })
  description: string
}
