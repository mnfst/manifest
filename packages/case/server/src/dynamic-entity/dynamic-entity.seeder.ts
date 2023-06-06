import 'dotenv/config'

import { DataSource, EntityMetadata } from 'typeorm'

seed()

async function seed() {
  // Create connection.
  const dataSource: DataSource = new DataSource({
    type: 'sqlite',
    database: 'db/case.sqlite',
    entities: [__dirname + './../**/*.entity{.ts,.js}']
  })
  await dataSource.initialize()

  const entities: EntityMetadata[] = dataSource.entityMetadatas

  const queryRunner = dataSource.createQueryRunner()

  const deleteTablePromises: Promise<void>[] = entities.map(
    async (entity: EntityMetadata) => {
      await queryRunner.query(`DELETE FROM ${entity.tableName}`)

      // Reset auto-increment.
      await queryRunner.query(
        `DELETE FROM sqlite_sequence WHERE name = '${entity.tableName}'`
      )
      return
    }
  )

  await Promise.all(deleteTablePromises)
  console.log('\x1b[35m', '[x] Removed all existing data...')

  const seedTablePromises: Promise<void>[] = []

  entities.forEach((entity: EntityMetadata) => {
    Array.from({ length: 10 }).forEach((_, index) => {
      seedTablePromises.push(
        queryRunner.query(
          `INSERT INTO ${entity.tableName} (${entity.columns
            .filter((column) => column.databaseName !== 'id')
            .map((column) => column.databaseName)
            .join(', ')}) VALUES (${entity.columns
            .filter((column) => column.databaseName !== 'id')
            .map((column) => `'test-value-${column.databaseName}'`)
            .join(', ')})`
        )
      )
    })
  })

  await Promise.all(seedTablePromises)

  await dataSource.destroy()

  console.log(
    '\x1b[33m',
    '[x] Seed complete ! Please refresh your browser to see the new data.'
  )
}
