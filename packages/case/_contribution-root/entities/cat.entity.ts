import { faker } from '../../server/node_modules/@faker-js/faker'
import { CaseEntity } from '../../server/src'
import { Entity } from '../../server/src/decorators/entity.decorator'
import { Prop } from '../../server/src/decorators/prop.decorator'

@Entity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cats',
  seedCount: 50,
  propIdentifier: 'name'
})
export class Cat extends CaseEntity {
  @Prop({
    seed: () => faker.person.firstName()
  })
  name: string
}
