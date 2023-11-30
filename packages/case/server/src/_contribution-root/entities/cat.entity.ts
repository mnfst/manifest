import { IsEnum, IsNotEmpty } from 'class-validator'

import { PropType } from '../../../../shared/enums/prop-type.enum'
import { Policies } from '../../api/policies'
import { BaseEntity } from '../../core-entities/base-entity'
import { Entity } from '../../crud/decorators/entity.decorator'
import { Prop } from '../../crud/decorators/prop.decorator'
import { Owner } from './owner.entity'

enum Status {
  unidentifiable = 'Unidentifiable',
  identified = 'Identified',
  vaccinated = 'Vaccinated',
  sterilized = 'Sterilized',
  fifth = 'Fifth',
  adopted = 'Adopted'
}

enum Breed {
  siamese = 'Siamese',
  persian = 'Persian',
  abyssinian = 'Abyssinian',
  tiger = 'Tiger',
  tabby = 'Tabby',
  tortoiseshell = 'Tortoiseshell'
}

@Entity({
  apiPolicies: {
    create: Policies.noRestriction
    // read: Policies.loggedInOnly
  }
})
export class Cat extends BaseEntity {
  @Prop()
  name: string

  @Prop({
    type: PropType.Textarea,
    validators: [IsNotEmpty()]
  })
  description: string

  @Prop({
    type: PropType.Number
  })
  age: number

  @Prop({
    type: PropType.Number,
    options: {
      isHidden: true
    }
  })
  hiddenProp: number

  @Prop({
    type: PropType.Link
  })
  website: string

  @Prop({
    type: PropType.Location,
    validators: [IsNotEmpty()]
  })
  location: string

  @Prop({
    type: PropType.Date,
    validators: [IsNotEmpty()]
  })
  birthDate: string

  @Prop({
    label: 'Owner',
    validators: [IsNotEmpty()],
    type: PropType.Relation,
    options: {
      entity: Owner,
      eager: true
    }
  })
  owner: Owner

  @Prop({
    label: 'Breed',
    validators: [IsNotEmpty(), IsEnum(Breed)],
    type: PropType.Enum,
    options: {
      enum: Breed
    }
  })
  breed: Breed

  @Prop({
    label: 'Status',
    type: PropType.Enum,
    options: {
      enum: Status,
      display: 'progress-bar'
    }
  })
  status: Status

  @Prop({
    type: PropType.Link
  })
  link: string
}
