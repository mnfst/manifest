import { IsEnum, IsNotEmpty } from 'class-validator'

import { PropType } from '../../../../shared/enums/prop-type.enum'
import { CaseEntity } from '../../core-entities/case.entity'
import { Entity } from '../../decorators/entity.decorator'
import { Prop } from '../../decorators/prop.decorator'
import { Owner } from './owner.entity'

/**
 * Status of the cat.
 */
enum Status {
  unidentifiable = 'Unidentifiable',
  identified = 'Identified',
  vaccinated = 'Vaccinated',
  sterilized = 'Sterilized',
  fifth = 'Fifth',
  adopted = 'Adopted'
}

/**
 * Breed of the cat.
 */
enum Breed {
  siamese = 'Siamese',
  persian = 'Persian',
  abyssinian = 'Abyssinian',
  tiger = 'Tiger',
  tabby = 'Tabby',
  tortoiseshell = 'Tortoiseshell'
}

/**
 * Cat entity that extends CaseEntity.
 */
@Entity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cats',
  seedCount: 50,
  propIdentifier: 'name'
})
export class Cat extends CaseEntity {
  /**
   * Name of the cat.
   */
  @Prop({})
  name: string

  /**
   * Description of the cat.
   */
  @Prop({
    type: PropType.Textarea,
    validators: [IsNotEmpty()]
  })
  description: string

  /**
   * Age of the cat.
   */
  @Prop({
    type: PropType.Number
  })
  age: number

   /**
   * Website of the cat.
   */
  @Prop({
    type: PropType.Link
  })
  website: string

  /**
   * Birth date of the cat.
   */
  @Prop({
    type: PropType.Date,
    validators: [IsNotEmpty()]
  })
  birthDate: string

  /**
   * Owner of the cat.
   */
  @Prop({
    label: 'Owner',
    validators: [IsNotEmpty()],
    type: PropType.Relation,
    options: {
      entity: Owner
    }
  })
  owner: Owner

  /**
   * Breed of the cat.
   */
  @Prop({
    label: 'Breed',
    validators: [IsNotEmpty(), IsEnum(Breed)],
    type: PropType.Enum,
    options: {
      enum: Breed
    }
  })
  breed: Breed

  /**
   * Status of the cat.
   */
  @Prop({
    label: 'Status',
    type: PropType.Enum,
    options: {
      enum: Status,
      display: 'progress-bar'
    }
  })
  status: Status

  /**
   * Link to the cat.
   */
  @Prop({
    type: PropType.Link
  })
  link: string
}
