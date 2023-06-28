import { CaseEntity, Entity, Prop } from '@casejs/case'


@Entity({
  nameSingular: '<%= name %>',
  namePlural: '<%= pluralizedName %>',
  propIdentifier: 'name',
  slug: '<%= dasherizedName %>',
})
export class <%= classifiedName %> extends CaseEntity {
  @Prop()
  name: string
}
