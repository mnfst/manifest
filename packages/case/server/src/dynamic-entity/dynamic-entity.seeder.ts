import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata } from 'typeorm'

@Injectable()
export class DynamicEntitySeeder {
  constructor(private dataSource: DataSource) {}

  async seed() {
    const entities: EntityMetadata[] = this.dataSource.entityMetadatas

    const queryRunner = this.dataSource.createQueryRunner()

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
  }
}
