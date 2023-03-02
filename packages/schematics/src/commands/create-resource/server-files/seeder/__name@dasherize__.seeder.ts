import { DataSource } from 'typeorm'

import { <%= classify(name) %> } from '../../resources/<%= dasherize(name) %>/<%= dasherize(name) %>.entity'

export class <%= classify(name) %>Seeder {
  dataSource: DataSource
  count: number

  constructor(dataSource: DataSource, count: number) {
    this.dataSource = dataSource
    this.count = count
  }

  async seed(): Promise<<%= classify(name) %>[]> {
    console.log('\x1b[35m', '[] Seeding <%= camelize(name) %>s...')

    const properties: string[] = this.dataSource
      .getMetadata(<%= classify(name) %>)
      .ownColumns.map((column) => column.propertyName)

    const save<%= classify(name) %>Promises: Promise<<%= classify(name) %>>[] = Array.from(Array(this.count)).map(
      async (_value, index: number) => {
        return this.dataSource.manager.save(await this.new(properties, index))
      }
    )

    return Promise.all(save<%= classify(name) %>Promises).then((res) => {
      return res
    })
  }

  private new(properties: string[], index): Promise<<%= classify(name) %>> {
    const <%= camelize(name) %>Model = this.dataSource.manager.create(<%= classify(name) %>, {})

    properties.forEach((property: string) => {
      const seederFunction = Reflect.getMetadata(`${property}:seed`, <%= camelize(name) %>Model)
      if (seederFunction) {
        <%= camelize(name) %>Model[property] = seederFunction(index)
      }
    })

    return Promise.resolve(<%= camelize(name) %>Model)
  }
}
