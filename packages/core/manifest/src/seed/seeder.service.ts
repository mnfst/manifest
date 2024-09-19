import {
  AuthenticableEntity,
  BaseEntity,
  EntityManifest,
  PropertyManifest,
  RelationshipManifest
} from '@repo/types'
import { SHA3 } from 'crypto-js'
import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, QueryRunner, Repository } from 'typeorm'
import { EntityService } from '../entity/services/entity.service'
import { PropertyService } from '../entity/services/property.service'
import { RelationshipService } from '../entity/services/relationship.service'

import {
  ADMIN_ENTITY_MANIFEST,
  AUTHENTICABLE_PROPS,
  DEFAULT_ADMIN_CREDENTIALS
} from '../constants'
import { ManifestService } from '../manifest/services/manifest.service'

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
    let entityMetadatas: EntityMetadata[] =
      this.entityService.getEntityMetadatas()

    if (tableName) {
      entityMetadatas = entityMetadatas.filter(
        (entity: EntityMetadata) => entity.tableName === tableName
      )
    }

    // Truncate all tables.
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

    // Keep only regular tables for seeding.
    entityMetadatas = entityMetadatas.filter(
      (entity: EntityMetadata) => entity.tableType === 'regular'
    )

    for (const entityMetadata of entityMetadatas) {
      const repository: Repository<BaseEntity> =
        this.entityService.getEntityRepository({
          entityMetadata
        })

      if (entityMetadata.name === ADMIN_ENTITY_MANIFEST.className) {
        await this.seedAdmin(repository)
        continue
      }

      const entityManifest: EntityManifest =
        this.manifestService.getEntityManifest({
          className: entityMetadata.name,
          fullVersion: true
        })

      // Prevent logging during tests.
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          `✅ Seeding ${entityManifest.seedCount} ${entityManifest.seedCount > 1 ? entityManifest.namePlural : entityManifest.nameSingular}...`
        )
      }

      for (const _index of Array(entityManifest.seedCount).keys()) {
        const newRecord: BaseEntity = repository.create()

        if (entityManifest.authenticable) {
          entityManifest.properties.push(...AUTHENTICABLE_PROPS)
        }

        entityManifest.properties.forEach(
          (propertyManifest: PropertyManifest) => {
            newRecord[propertyManifest.name] =
              this.propertyService.getSeedValue(propertyManifest)
          }
        )

        entityManifest.relationships
          .filter(
            (relationship: RelationshipManifest) =>
              relationship.type === 'many-to-one'
          )
          .forEach((relationManifest: RelationshipManifest) => {
            newRecord[relationManifest.name] =
              this.relationshipService.getSeedValue(relationManifest)
          })

        await repository.save(newRecord)
      }
    }

    // Seed many to many relationships after all entities have been seeded.
    const manyToManyPromises: Promise<BaseEntity>[] = []

    for (const entityMetadata of entityMetadatas) {
      const entityManifest: EntityManifest =
        this.manifestService.getEntityManifest({
          className: entityMetadata.name,
          fullVersion: true
        })

      const repository: Repository<BaseEntity> =
        this.entityService.getEntityRepository({
          entityMetadata
        })

      const allRecords: BaseEntity[] = await repository.find()

      entityManifest.relationships
        .filter(
          (relationship: RelationshipManifest) =>
            relationship.type === 'many-to-many'
        )
        .forEach((relationshipManifest: RelationshipManifest) => {
          allRecords.forEach(async (record: BaseEntity) => {
            record[relationshipManifest.name] =
              this.relationshipService.getSeedValue(relationshipManifest)

            manyToManyPromises.push(repository.save(record))
          })
        })
    }

    await Promise.all(manyToManyPromises)

    return
  }

  /**
   * Seed the Admin table with default credentials. Only one admin user is created.
   *
   * @param repository The repository for the Admin entity.
   */
  private async seedAdmin(repository: Repository<BaseEntity>): Promise<void> {
    const admin: AuthenticableEntity =
      repository.create() as AuthenticableEntity
    admin.email = DEFAULT_ADMIN_CREDENTIALS.email
    admin.password = SHA3(DEFAULT_ADMIN_CREDENTIALS.password).toString()

    await repository.save(admin)
  }
}
