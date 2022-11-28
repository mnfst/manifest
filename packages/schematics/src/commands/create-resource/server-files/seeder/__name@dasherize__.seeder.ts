import * as faker from 'faker/locale/fr'
import { DataSource, EntityManager } from 'typeorm'

import { <%= classify(name) %> } from '../../resources/<%= dasherize(name) %>/<%= dasherize(name) %>.entity'

export class <%= classify(name) %>Seeder {
  entityManager: EntityManager
  count: number

  constructor(dataSource: DataSource, count: number) {
    this.entityManager = dataSource.manager
    this.count = count
  }

  async seed(): Promise<<%= classify(name) %>[]> {
    console.log('\x1b[35m', '[] Seeding <%= camelize(name) %>s...')
    const save<%= classify(name) %>Promises: Promise<<%= classify(name) %>>[] = Array.from(Array(this.count)).map(
      async () => {
        return this.entityManager.save(await this.get<%= classify(name) %>())
      }
    )

    return Promise.all(save<%= classify(name) %>Promises).then((res) => {
      return res
    })
  }

  private get<%= classify(name) %>(): Promise<<%= classify(name) %>> {
    const <%= camelize(name) %>: <%= classify(name) %> = this.entityManager.create(<%= classify(name) %>, {
      // Insert factory properties here.
      name: faker.lorem.word()
    })

    return Promise.resolve(<%= camelize(name) %>)
  }
}