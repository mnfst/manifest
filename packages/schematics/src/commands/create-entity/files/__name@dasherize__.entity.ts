import { BaseEntity, Entity, Prop } from '@casejs/case'

@Entity()
export class <%= classifiedName %> extends BaseEntity {
  @Prop()
  name: string

  // Learn more about CASE Entities and how to add properties here: https://docs.case.app/properties
}
