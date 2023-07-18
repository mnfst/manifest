import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'

enum myEnum {
  a = 1,
  b = 2
}

@Entity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cats',
  seedCount: 50,
  propIdentifier: 'name'
})
export class Cat extends CaseEntity {
  @Prop({})
  name: string

  @Prop({
    type: PropType.Number
  })
  age: number

  @Prop({
    type: PropType.Enum,
    options: {
      enum: myEnum,
      defaultValue: myEnum.a
    }
  })
  enum: myEnum
}
