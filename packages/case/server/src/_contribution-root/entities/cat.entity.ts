import { faker } from '@faker-js/faker'
import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'
import { Owner } from './owner.entity'

enum dummyEnum {
  one = 'OneBis',
  two = 'TwoBis',
  three = 'ThreeBis'
}

enum colorEnum {
  two = 'success',
  one = 'danger',
  three = 'warning'
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
    label: 'Owner',
    type: PropType.Relation,
    options: {
      entity: Owner
    }
  })
  owner: Owner

  @Prop({
    label: 'Species',
    type: PropType.Enum,
    seed: () => faker.helpers.arrayElement(Object.values(dummyEnum)),
    options: {
      enum: dummyEnum,
      defaultValue: dummyEnum.one,
      color: colorEnum
    }
  })
  specie: string
}
