import { BeforeInsert } from 'typeorm'

import { IsNotEmpty } from 'class-validator'
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
    type: PropType.Text,
    validators: [IsNotEmpty()]
  })
  familyName: string

  @Prop({
    type: PropType.File,
    validators: [IsNotEmpty()]
  })
  certificate: string

  @Prop({
    type: PropType.Image,
    validators: [IsNotEmpty()]
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

  @BeforeInsert()
  beforeInsert() {
    this.description = `${this.nickName} is the mouse hunted by ${this._relations.predator.name}`
  }
}
