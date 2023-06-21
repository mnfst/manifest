import { Entity, PrimaryGeneratedColumn } from 'typeorm'

import { CaseProp } from '../decorators/case-prop.decorator'
import { PropType } from '../dynamic-entity/prop-types/prop-type.enum'

@Entity()
export class Cat {
  public static definition = {
    nameSingular: 'cat',
    namePlural: 'cats',
    slug: 'cat'
  }

  @PrimaryGeneratedColumn()
  id: number

  @CaseProp({
    type: PropType.String,
    seed: (index?: number) => index
  })
  name: string

  @CaseProp({
    type: PropType.Integer,
    seed: (index?: number) => index
  })
  age: string
}
