import { CaseEntity, Entity, Prop, PropType } from '@casejs/case'

@Entity({
  nameSingular: '<%= name %>',
  namePlural: '<%= pluralizedName %>',
  propIdentifier: 'name',
  slug: '<%= dasherizedName %>s',
})
export class <%= classifiedName %> extends CaseEntity {
  @Prop({
    type: PropType.Text
  })
  name: string

  // Learn more about CASE Entities and how to add properties here: https://docs.case.app/properties
}
