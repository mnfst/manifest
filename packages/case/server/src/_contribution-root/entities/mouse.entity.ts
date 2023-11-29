import { BeforeInsert } from 'typeorm'

import { IsNotEmpty } from 'class-validator'
import { PropType } from '../../../../shared/enums/prop-type.enum'

import { BaseEntity } from '../../core-entities/base-entity'
import { Entity } from '../../crud/decorators/entity.decorator'
import { Prop } from '../../crud/decorators/prop.decorator'
import { Cat } from './cat.entity'

@Entity()
export class Mouse extends BaseEntity {
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
    validators: [IsNotEmpty()],
    options: {
      sizes: [
        {
          name: 'small',
          height: 100,
          width: 100
        }
      ]
    }
  })
  image: JSON

  @Prop({
    label: 'Choose a Predator',
    type: PropType.Relation,
    options: {
      entity: Cat
    }
  })
  predator: Cat

  @Prop({
    type: PropType.Textarea
  })
  description: string

  @BeforeInsert()
  beforeInsert() {
    this.description = `${this.nickName} is the mouse hunted by ${this._relations.predator.name}`
  }
}
