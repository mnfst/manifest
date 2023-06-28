import { Prop } from '../decorators/case-prop.decorator'
import { Entity } from '../decorators/entity.decorator'
import { CaseEntity } from './case-entity'

@Entity({
  nameSingular: 'user',
  namePlural: 'users',
  slug: 'user',
  propIdentifier: 'name'
})
export class User extends CaseEntity {
  @Prop()
  name: string

  @Prop()
  familyName: string
}
