import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class User {
  public static definition = {
    nameSingular: 'User',
    namePlural: 'Users'
  }

  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  familyName: string
}
