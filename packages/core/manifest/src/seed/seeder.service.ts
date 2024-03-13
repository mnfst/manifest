import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, QueryRunner } from 'typeorm'
import { EntityMetaService } from '../entity/services/entity-meta/entity-meta.service'
import { ManifestService } from '../manifest/services/manifest/manifest.service'
import { EntityManifest } from '../manifest/typescript/manifest-types'

@Injectable()
export class SeederService {
  constructor(
    private entityMetaService: EntityMetaService,
    private manifestService: ManifestService,
    private dataSource: DataSource
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
    let entityMetadatas: EntityMetadata[]

    if (tableName) {
      entityMetadatas = entityMetadatas.filter(
        (entity: EntityMetadata) => entity.tableName === tableName
      )
    } else {
      entityMetadatas = this.entityMetaService.getEntityMetadata()
    }

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner()
    // TODO: if we reverse the array we do not need to disable foreign keys.
    await queryRunner.query('PRAGMA foreign_keys = OFF')
    await Promise.all(
      entityMetadatas.map(async (entity: EntityMetadata) =>
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

    for (const entityMetadata of entityMetadatas) {
      const entityManifest: EntityManifest =
        this.manifestService.getEntityManifest({
          className: entityMetadata.name,
          fillDefaults: true
        })

      console.log(
        `[x] Seeding ${entityManifest.seedCount} ${entityManifest.seedCount > 1 ? entityManifest.namePlural : entityManifest.nameSingular}...`
      )

      for (const index of Array(entityManifest.seedCount).keys()) {
        // TODO: Create a new record.
        // TODO: For each property get the seedFunction if exists or the default one.
        // TODO: For the relations get the definition of related entity to know seed count and randomize.
      }
    }

    return Promise.resolve()
  }
}
