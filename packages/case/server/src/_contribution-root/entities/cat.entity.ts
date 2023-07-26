import { faker } from '@faker-js/faker'
import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'
import { Owner } from './owner.entity'
import { YieldType } from '../../../../shared/enums/yield-type.enum'

enum statusEnum {
  identified = 'Identified',
  vaccinated = 'Vaccinated',
  sterilized = 'Sterilized',
  adopted = 'Adopted'
}

enum breedEnum {
  siamese = 'Siamese',
  persian = 'Persian',
  abyssinian = 'Abyssinian',
  tiger = 'Tiger',
  tabby = 'Tabby',
  calico = 'Calico',
  tortoiseshell = 'Tortoiseshell'
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
    seed: () => faker.helpers.arrayElement(Object.values(breedEnum)),
    options: {
      enum: breedEnum,
      display: YieldType.Label
    }
  })
  breed: string

  @Prop({
    label: 'Status',
    type: PropType.Enum,
    seed: () => faker.helpers.arrayElement(Object.values(statusEnum)),
    options: {
      enum: statusEnum,
      display: YieldType.ProgressBar
    }
  })
  status: string
}
