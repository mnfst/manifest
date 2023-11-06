import { BaseEntity, Entity, Prop, PropType } from '@casejs/case'

@Entity()
export class <%= classifiedName %> extends BaseEntity {
  @Prop({
    type: PropType.Text
  })
  name: string

  // Learn more about CASE Entities and how to add properties here: https://docs.case.app/properties
}
