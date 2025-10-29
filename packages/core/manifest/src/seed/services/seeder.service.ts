import {
  AdminEntity,
  AppManifest,
  BaseEntity,
  DatabaseConnection,
  EntityManifest,
  ImageSize,
  PropType,
  PropertyManifest,
  RelationshipManifest
} from '@repo/types'

import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, QueryRunner, Repository } from 'typeorm'
import { EntityService } from '../../entity/services/entity.service'

import { faker } from '@faker-js/faker'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'

import {
  ADMIN_ENTITY_MANIFEST,
  AUTHENTICABLE_PROPS,
  DEFAULT_ADMIN_CREDENTIALS,
  DEFAULT_MAX_MANY_TO_MANY_RELATIONS,
  DUMMY_FILE_NAME,
  DUMMY_IMAGE_NAME
} from '../../constants'

import { StorageService } from '../../storage/services/storage.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { ManifestService } from '../../manifest/services/manifest.service'

@Injectable()
export class SeederService {
  seededFiles: { [key: string]: string } = {}
  seededImages: { [key: string]: { [key: string]: string } } = {}
  records: { [key: string]: BaseEntity[] } = {}

  constructor(
    private entityService: EntityService,
    private manifestService: ManifestService,
    private entityManifestService: EntityManifestService,
    private storageService: StorageService,
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
  async seed({
    tableName,
    silent
  }: {
    tableName?: string
    silent?: boolean
  } = {}): Promise<void> {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    if (appManifest.environment === 'production') {
      throw new Error('Seeding is not allowed in production environment')
    }

    let entityMetadatas: EntityMetadata[] =
      this.entityService.getEntityMetadatas()

    if (tableName) {
      entityMetadatas = entityMetadatas.filter(
        (entity: EntityMetadata) => entity.tableName === tableName
      )
    }

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner()

    const dbConnection: DatabaseConnection = this.dataSource.options
      .type as DatabaseConnection

    // Truncate all tables.
    switch (dbConnection) {
      case 'postgres':
        // Disable foreign key checks for Postgres by using CASCADE
        await Promise.all(
          entityMetadatas.map(async (entity: EntityMetadata) =>
            queryRunner.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE`)
          )
        )

        // Reset auto-increment sequences
        await Promise.all(
          entityMetadatas.map(
            async (entity: EntityMetadata) =>
              queryRunner
                .query(
                  `ALTER SEQUENCE "${entity.tableName}_id_seq" RESTART WITH 1`
                )
                .catch(() => {}) // Ignore if sequence doesn't exist
          )
        )
        break

      case 'mysql':
        // Disable foreign key checks for MySQL
        await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0')

        // Truncate tables
        await Promise.all(
          entityMetadatas.map(async (entity: EntityMetadata) =>
            queryRunner.query(`TRUNCATE TABLE \`${entity.tableName}\``)
          )
        )
        break

      case 'sqlite':
        // SQLite-specific logic.
        await queryRunner.query('PRAGMA foreign_keys = OFF')
        await Promise.all(
          entityMetadatas.map(async (entity: EntityMetadata) =>
            queryRunner.query(`DELETE FROM [${entity.tableName}]`)
          )
        )
        await queryRunner.query('PRAGMA foreign_keys = ON')
        break
    }
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
        await this.seedAdmin({
          repository,
          silent
        })
        continue
      }

      const entityManifest: EntityManifest =
        this.entityManifestService.getEntityManifest({
          className: entityMetadata.name,
          fullVersion: true,
          includeNested: true
        })

      if (!entityManifest.nested && !silent) {
        console.log(
          `✅ Seeding ${entityManifest.seedCount} ${entityManifest.seedCount > 1 ? entityManifest.namePlural : entityManifest.nameSingular}...`
        )
      }

      for (let i = 0; i < entityManifest.seedCount; i++) {
        const newRecord: BaseEntity = repository.create()

        if (entityManifest.authenticable) {
          entityManifest.properties.push(...AUTHENTICABLE_PROPS)
        }

        for (const propertyManifest of entityManifest.properties) {
          newRecord[propertyManifest.name] = await this.seedProperty(
            propertyManifest,
            entityManifest
          )
        }

        let manyToOneRelationships: RelationshipManifest[] =
          entityManifest.relationships.filter(
            (relationship: RelationshipManifest) =>
              relationship.type === 'many-to-one'
          )

        let oneToOneRelationships: RelationshipManifest[] =
          entityManifest.relationships.filter(
            (relationship: RelationshipManifest) =>
              relationship.type === 'one-to-one' && relationship.owningSide
          )

        // On nested entities, if related to several entities, we only seed to one as it's is not possible to be related to multiple items.

        if (entityManifest.nested) {
          if (manyToOneRelationships.length > 1) {
            // Get a random many to one relationship.
            manyToOneRelationships = [
              manyToOneRelationships[
                faker.number.int({
                  min: 0,
                  max: manyToOneRelationships.length - 1
                })
              ]
            ]
          }
          if (oneToOneRelationships.length > 1) {
            // Get a random one to one relationship.
            oneToOneRelationships = [
              oneToOneRelationships[
                faker.number.int({
                  min: 0,
                  max: oneToOneRelationships.length - 1
                })
              ]
            ]
          }
        }

        for (const relationship of manyToOneRelationships) {
          newRecord[relationship.name] =
            await this.seedRelationships(relationship)
        }

        for (const relationship of oneToOneRelationships) {
          newRecord[relationship.name] =
            await this.seedRelationships(relationship)
        }

        await repository.save(newRecord)
      }
    }

    // Seed many to many relationships after all entities have been seeded.
    const manyToManyPromises: Promise<BaseEntity>[] = []

    for (const entityMetadata of entityMetadatas) {
      const entityManifest: EntityManifest =
        this.entityManifestService.getEntityManifest({
          className: entityMetadata.name,
          fullVersion: true,
          includeNested: true
        })

      const repository: Repository<BaseEntity> =
        this.entityService.getEntityRepository({
          entityMetadata
        })

      const allRecords: BaseEntity[] = await repository.find()

      const manyToManyRelationships: RelationshipManifest[] =
        entityManifest.relationships.filter(
          (relationship: RelationshipManifest) =>
            relationship.type === 'many-to-many' && relationship.owningSide
        )

      for (const relationshipManifest of manyToManyRelationships) {
        for (const record of allRecords) {
          record[relationshipManifest.name] =
            await this.seedRelationships(relationshipManifest)

          manyToManyPromises.push(repository.save(record))
        }
      }
    }

    await Promise.all(manyToManyPromises)

    return
  }

  /**
   * Seed a property with a default value.
   *
   * @param propertyManifest The property manifest.
   *
   * @returns The seeded value.
   *
   * @todo can this be moved to a separate service ? Beware of functions and context.
   */
  async seedProperty(
    propertyManifest: PropertyManifest,
    entityManifest: EntityManifest
  ): Promise<string | number | boolean | object | unknown> {
    const typeHandlers: { [key: string]: () => Promise<unknown> } = {
      [PropType.String]: () => Promise.resolve(faker.commerce.product()),
      [PropType.Number]: () => Promise.resolve(faker.number.int({ max: 50 })),
      [PropType.Link]: () => Promise.resolve('https://manifest.build'),
      [PropType.Text]: () =>
        Promise.resolve(faker.commerce.productDescription()),
      [PropType.RichText]: () => Promise.resolve(this.seedRichText()),
      [PropType.Money]: () =>
        Promise.resolve(faker.finance.amount({ min: 1, max: 500, dec: 2 })),
      [PropType.Date]: () => Promise.resolve(faker.date.past()),
      [PropType.Timestamp]: () => Promise.resolve(faker.date.recent()),
      [PropType.Email]: () => Promise.resolve(faker.internet.email()),
      [PropType.Boolean]: () => Promise.resolve(faker.datatype.boolean()),
      [PropType.Password]: () =>
        Promise.resolve(bcrypt.hashSync('manifest', 1)),
      [PropType.Choice]: () =>
        Promise.resolve(this.seedChoice(propertyManifest)),
      [PropType.Location]: () => Promise.resolve(this.seedLocation()),
      [PropType.File]: () => this.seedFile(propertyManifest, entityManifest),
      [PropType.Image]: () => this.seedImage(propertyManifest, entityManifest)
    }

    const handler = typeHandlers[propertyManifest.type]
    if (handler) {
      return handler()
    }

    return Promise.reject(
      new Error(`Unsupported property type: ${propertyManifest.type}`)
    )
  }

  private seedRichText(): string {
    return `
      <h1>${faker.commerce.productName()}</h1>
      <p>This is a dummy HTML content with <a href="https://manifest.build">links</a> and <strong>bold text</strong></p>
      <ul>
        <li>${faker.commerce.productAdjective()}</li>
        <li>${faker.commerce.productAdjective()}</li>
        <li>${faker.commerce.productAdjective()}</li>
      </ul>
      <h2>${faker.commerce.productName()}</h2>
      <p>${faker.commerce.productDescription()}<p>
    `
  }

  private seedChoice(propertyManifest: PropertyManifest): unknown {
    return faker.helpers.arrayElement(
      propertyManifest.options.values as unknown[]
    )
  }

  private async seedFile(
    propertyManifest: PropertyManifest,
    entityManifest: EntityManifest
  ): Promise<string> {
    const fileKey = `${entityManifest.slug}.${propertyManifest.name}`

    // Return the seeded file if it already exists.
    if (this.seededFiles[fileKey]) {
      return this.seededFiles[fileKey]
    }

    const dummyFileContent = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'assets', DUMMY_FILE_NAME)
    )

    const filePath: string = await this.storageService.storeFileForProperty(
      entityManifest.slug,
      propertyManifest.name,
      {
        originalname: DUMMY_FILE_NAME,
        buffer: dummyFileContent
      }
    )

    this.seededFiles[fileKey] = filePath
    return filePath
  }

  private async seedImage(
    propertyManifest: PropertyManifest,
    entityManifest: EntityManifest
  ): Promise<{ [key: string]: string }> {
    const imageKey = `${entityManifest.slug}.${propertyManifest.name}`

    // Return the seeded image if it already exists.
    if (this.seededImages[imageKey]) {
      return this.seededImages[imageKey]
    }

    const dummyImageContent = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'assets', DUMMY_IMAGE_NAME)
    )

    const images: { [key: string]: string } =
      await this.storageService.storeImageForProperty(
        entityManifest.slug,
        propertyManifest.name,
        {
          originalname: DUMMY_IMAGE_NAME,
          buffer: dummyImageContent
        },
        propertyManifest.options?.['sizes'] as ImageSize[]
      )

    this.seededImages[imageKey] = images
    return images
  }

  private seedLocation(): { lat: number; lng: number } {
    return {
      lat: faker.location.latitude(),
      lng: faker.location.longitude()
    }
  }

  /**
   * Seed the Admin table with default credentials. Only one admin user is created.
   *
   * @param repository The repository for the Admin entity.
   */
  async seedAdmin({
    repository,
    silent
  }: {
    repository: Repository<BaseEntity>
    silent?: boolean
  }): Promise<void> {
    if (!silent) {
      console.log(
        `✅ Seeding default admin ${DEFAULT_ADMIN_CREDENTIALS.email} with password "${DEFAULT_ADMIN_CREDENTIALS.password}"...`
      )
    }

    const admin: AdminEntity = repository.create() as AdminEntity
    admin.email = DEFAULT_ADMIN_CREDENTIALS.email
    admin.password = bcrypt.hashSync(DEFAULT_ADMIN_CREDENTIALS.password, 1)

    // Full access for initial admin.
    admin.hasBackendBuilderAccess = true
    admin.hasContentManagerAccess = true
    admin.hasApiDocsAccess = true

    await repository.save(admin)
  }

  /**
   * Get the seed value for a relationship based on the number of relation items (seed count).
   *
   * @param relationshipManifest The relationship manifest in its detailed form.
   *
   * @returns An single id or an array of objects with an id property.
   *
   **/
  async seedRelationships(
    relationshipManifest: RelationshipManifest
  ): Promise<string | { id: string }[]> {
    const relatedEntityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({
        entityMetadata: this.entityService.getEntityMetadata({
          className: relationshipManifest.entity
        })
      })

    // Store all items in memory to avoid multiple queries.
    if (!this.records[relationshipManifest.entity]) {
      this.records[relationshipManifest.entity] =
        await relatedEntityRepository.find({
          select: ['id']
        })
    }

    if (relationshipManifest.type === 'many-to-one') {
      return this.getRandomUniqueIds(
        this.records[relationshipManifest.entity].map(
          (item: BaseEntity) => item.id
        ),
        1
      )[0]
    } else if (relationshipManifest.type === 'many-to-many') {
      // On many-to-many relationships, we need to generate a random number of relations.
      const max: number = Math.min(
        DEFAULT_MAX_MANY_TO_MANY_RELATIONS,
        this.records[relationshipManifest.entity].length
      )

      const numberOfRelations: number = faker.number.int({
        min: 0,
        max
      })

      return this.getRandomUniqueIds(
        this.records[relationshipManifest.entity].map(
          (item: BaseEntity) => item.id
        ),
        numberOfRelations
      ).map((id: string) => ({ id }))
    } else if (relationshipManifest.type === 'one-to-one') {
      // For one-to-one relationships, we only need one related item.
      return this.getRandomUniqueIds(
        this.records[relationshipManifest.entity].map(
          (item: BaseEntity) => item.id
        ),
        1
      )[0]
    }
  }

  /**
   * Generates an array of unique IDs from the provided list.
   *
   * @param ids The array of IDs to choose from.
   * @param count The number of unique IDs to return.
   *
   * @return An array of unique IDs, randomly selected from the provided list.
   */
  private getRandomUniqueIds(ids: string[], count: number): string[] {
    const shuffled = [...ids].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(count, ids.length))
  }
}
