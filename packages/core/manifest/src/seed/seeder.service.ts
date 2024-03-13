import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, QueryRunner, Repository } from 'typeorm'
import { EntityService } from '../entity/services/entity/entity.service'
import { PropertyService } from '../entity/services/property/property.service'
import { RelationshipService } from '../entity/services/relationship/relationship.service'
import { ManifestService } from '../manifest/services/manifest/manifest.service'
import {
  EntityManifest,
  PropertyManifest,
  RelationshipManifest
} from '../manifest/typescript/manifest-types'

@Injectable()
export class SeederService {
  constructor(
    private entityService: EntityService,
    private propertyService: PropertyService,
    private relationshipService: RelationshipService,
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
      entityMetadatas = this.entityService.getEntityMetadata()
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
      const repository: Repository<any> =
        this.entityService.getEntityRepository(entityMetadata)

      const entityManifest: EntityManifest =
        this.manifestService.getEntityManifest({
          className: entityMetadata.name,
          fillDefaults: true
        })

      console.log(
        `[x] Seeding ${entityManifest.seedCount} ${entityManifest.seedCount > 1 ? entityManifest.namePlural : entityManifest.nameSingular}...`
      )

      for (const index of Array(entityManifest.seedCount).keys()) {
        const newRecord = repository.create()

        Object.entries(entityManifest.properties).forEach(
          ([propertyName, propertyManifest]: [string, PropertyManifest]) => {
            newRecord[propertyName] =
              this.propertyService.getSeedValue(propertyManifest)
          }
        )

        Object.entries(entityManifest.belongsTo || []).forEach(
          ([relationName, relationManifest]: [
            string,
            RelationshipManifest
          ]) => {
            newRecord[relationName] =
              this.relationshipService.getSeedValue(relationManifest)
          }
        )

        console.log(entityManifest.name, newRecord)

        await repository.save(newRecord)
      }
    }

    return Promise.resolve()
  }
}
