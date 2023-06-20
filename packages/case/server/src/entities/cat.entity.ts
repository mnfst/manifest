import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { CaseProp } from '../decorators/case-prop.decorator'

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
    seed: (index?: number) => index
  })
  age: string
}
