import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'

enum dummyEnum {
  one = 'OneBis',
  two = 'TwoBis',
  three = 'ThreeBis'
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
      enum: dummyEnum,
      defaultValue: dummyEnum.one
    }
  })
  specie: string
}
