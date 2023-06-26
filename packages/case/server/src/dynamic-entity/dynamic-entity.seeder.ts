import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, Repository } from 'typeorm'

import { EntityDefinition } from '../../../shared/interfaces/entity-definition.interface'

@Injectable()
export class DynamicEntitySeeder {
  defaultSeedCount = 10

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

    const seedPromises: Promise<void>[] = []

    entities.forEach((entity: EntityMetadata) => {
      const definition: EntityDefinition = (entity.target as any).definition

      const entityRepository: Repository<any> = this.getRepository(
        entity.tableName
      )

      console.log('\x1b[35m', `[x] Seeding ${definition.namePlural}...`)

      Array.from({
        length: definition.seedCount || this.defaultSeedCount
      }).forEach((_, index) => {
        const newItem = entityRepository.create()

        entity.columns.forEach((column) => {
          if (column.propertyName === 'id') {
            return
          }

          const propSeederFn = Reflect.getMetadata(
            `${column.propertyName}:seed`,
            newItem
          )

          newItem[column.propertyName] = propSeederFn(index)
        })

        seedPromises.push(entityRepository.save(newItem))
      })
    })

    await Promise.all(seedPromises)
  }

  private getRepository(entityTableName: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) => entity.tableName === entityTableName
    )

    if (!entity) {
      throw new Error('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }
}
