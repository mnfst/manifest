import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, QueryRunner } from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'
import { EntityLoaderService } from '../entity/services/entity-loader/entity-loader.service'

@Injectable()
export class Seeder {
  constructor(
    private dataSource: DataSource,
    private EntityService: EntityLoaderService
  ) {}

  /**
   * Seed the database with dummy data.
   *
   * @param tableName The name of the table to seed. If not provided, all tables will be seeded.
   *
   * @returns A promise that resolves when the seeding is complete.
   *
   */
  async seed(tableName?: string): Promise<void> {
    let entities: EntityMetadata[]

    if (tableName) {
      entities = entities.filter(
        (entity: EntityMetadata) => entity.tableName === tableName
      )
    } else {
      entities = this.sortEntitiesByHierarchy(this.dataSource.entityMetadatas)
    }

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner()
    await queryRunner.query('PRAGMA foreign_keys = OFF')
    await Promise.all(
      entities.map(async (entity: EntityMetadata) =>
        queryRunner
          .query(`DELETE FROM ${entity.tableName}`)
          .then(() =>
            queryRunner.query(
              `DELETE FROM sqlite_sequence WHERE name = '${entity.tableName}'`
            )
          )
      )
    )
    await queryRunner.query('PRAGMA foreign_keys = ON')

    console.log('[x] Removed all existing data...')

    for (const entity of entities) {
      console.log(`[x] Seeding ${entity.name}...`)

      console.log(this.EntityService.getEntityMetadata(entity.name))
    }

    return Promise.resolve()
  }

  /**
   * Sort entities by hierarchy in order to seed them in the correct order.
   * An entity with a foreign key to another entity should be seeded after the entity it references.
   *
   * @param entities The entities to sort.
   *
   * @returns The sorted entities.
   *
   * */
  private sortEntitiesByHierarchy(
    entities: EntityMetadata[]
  ): EntityMetadata[] {
    const orderedEntities: EntityMetadata[] = []

    entities.forEach((entity: EntityMetadata) => {
      const relationColumns: ColumnMetadata[] = entity.columns.filter(
        (column: ColumnMetadata) => column.relationMetadata
      )

      if (!relationColumns.length) {
        orderedEntities.push(entity)
      } else {
        relationColumns.forEach((relationColumn: ColumnMetadata) => {
          const relatedEntity: EntityMetadata =
            relationColumn.relationMetadata.entityMetadata

          if (orderedEntities.includes(relatedEntity)) {
            orderedEntities.splice(
              orderedEntities.indexOf(relatedEntity),
              0,
              entity
            )
          } else {
            orderedEntities.push(entity)
          }
        })
      }
    })

    return orderedEntities
  }
}
