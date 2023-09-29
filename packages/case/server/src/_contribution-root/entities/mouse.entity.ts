import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'
import { Cat } from './cat.entity'

/**
 * Mouse entity that extends CaseEntity.
 */
@Entity({
  nameSingular: 'mouse',
  namePlural: 'mouses',
  slug: 'mouses',
  propIdentifier: 'nickName'
})
export class Mouse extends CaseEntity {
  
  /**
   * Nickname of the mouse.
   */
  @Prop({
    label: 'Nickname',
    type: PropType.Text,
    seed: (index?: number) => `Mouse ${index}`
  })
  nickName: string

  /**
   * Family name of the mouse.
   */
  @Prop({
    label: 'Family name',
    type: PropType.Text
  })
  familyName: string

  /**
   * Certificate of the mouse.
   */
  @Prop({
    type: PropType.File
  })
  certificate: string

  /**
   * Image of the mouse.
   */
  @Prop({
    type: PropType.Image
  })
  image: string

  /**
   * Predator of the mouse.
   */
  @Prop({
    label: 'Choose a Predator',
    type: PropType.Relation,
    options: {
      entity: Cat
    }
  })
  predator: Cat

  
  /**
   * Password of the mouse.
   */
  @Prop({
    type: PropType.Password
  })
  password: string

  
  /**
   * Description of the mouse.
   */
  @Prop({
    type: PropType.Textarea
  })
  description: string
}
