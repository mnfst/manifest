import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

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

  @Column()
  name: string

  @Column()
  @CaseProp({
    seed: (index?: number) => index,
    type: PropType.Integer
  })
  age: string
}
