import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class User {
  public static definition = {
    nameSingular: 'user',
    namePlural: 'users',
    slug: 'user'
  }

  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  familyName: string
}
