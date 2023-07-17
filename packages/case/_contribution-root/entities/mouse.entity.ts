import { CaseEntity } from '../../server/src'
import { Entity } from '../../server/src/decorators/entity.decorator'
import { Prop } from '../../server/src/decorators/prop.decorator'
import { PropType } from '../../shared/enums/prop-type.enum'
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
    label: 'Predator',
    type: PropType.Relation,
    options: {
      entity: Cat
    }
  })
  predator: Cat
}
