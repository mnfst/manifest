import { Injectable } from '@nestjs/common'
import { error } from 'console'
import { DataSource, EntityMetadata, Repository } from 'typeorm'

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
      const entityRepository: Repository<any> = this.getRepository(
        entity.tableName
      )

      console.log('\x1b[35m', `[x] Seeding ${entity.tableName}...`)

      Array.from({ length: 10 }).forEach((_, index) => {
        const newEntity = {}

        entity.columns.forEach((column) => {
          if (column.databaseName === 'id') {
            return
          }
          newEntity[column.databaseName] = `test-value-${column.databaseName}`
        })

        seedTablePromises.push(entityRepository.save(newEntity))
      })
    })

    await Promise.all(seedTablePromises)
  }

  private getRepository(entityTableName: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) => entity.tableName === entityTableName
    )

    if (!entity) {
      throw new error('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }
}
