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
    type: PropType.Textarea
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
   * Owner of the cat.
   */
  @Prop({
    label: 'Owner',
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
   * Link related to the cat.
   */
  @Prop({
    type: PropType.Link
  })
  link: string
}
