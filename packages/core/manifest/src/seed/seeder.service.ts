import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, QueryRunner, Repository } from 'typeorm'
import { EntityService } from '../entity/services/entity/entity.service'
import { PropertyService } from '../entity/services/property/property.service'
import { RelationshipService } from '../entity/services/relationship/relationship.service'
import { BaseEntity } from '../entity/types/base-entity.interface'
import { ManifestService } from '../manifest/services/manifest/manifest.service'
import { EntityManifest } from '../manifest/typescript/manifest-types'
import { DetailedPropertyManifest } from '../manifest/typescript/other/detailed-property-manifest.type'
import { DetailedRelationshipManifest } from '../manifest/typescript/other/detailed-relationship-manifest.type'

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
      entityMetadatas = this.entityService.getEntityMetadatas()
    }

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner()
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
      const repository: Repository<BaseEntity> =
        this.entityService.getEntityRepository(entityMetadata)

      const entityManifest: EntityManifest =
        this.manifestService.getEntityManifest({
          className: entityMetadata.name
        })

      console.log(
        `[x] Seeding ${entityManifest.seedCount} ${entityManifest.seedCount > 1 ? entityManifest.namePlural : entityManifest.nameSingular}...`
      )

      for (const _index of Array(entityManifest.seedCount).keys()) {
        const newRecord: BaseEntity = repository.create()

        Object.entries(entityManifest.properties).forEach(
          ([propertyName, propertyManifest]: [
            string,
            DetailedPropertyManifest
          ]) => {
            newRecord[propertyName] =
              this.propertyService.getSeedValue(propertyManifest)
          }
        )

        Object.entries(entityManifest.belongsTo || []).forEach(
          ([relationName, relationManifest]: [
            string,
            DetailedRelationshipManifest
          ]) => {
            newRecord[relationName] =
              this.relationshipService.getSeedValue(relationManifest)
          }
        )

        await repository.save(newRecord)
      }
    }

    return Promise.resolve()
  }
}
