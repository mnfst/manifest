import {
  AuthenticableEntity,
  BaseEntity,
  DatabaseConnection,
  EntityManifest,
  ImageSizesObject,
  PropType,
  PropertyManifest,
  RelationshipManifest
} from '@repo/types'

import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, QueryRunner, Repository } from 'typeorm'
import { EntityService } from '../../entity/services/entity.service'
import { RelationshipService } from '../../entity/services/relationship.service'

import { faker } from '@faker-js/faker'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'

import {
  ADMIN_ENTITY_MANIFEST,
  AUTHENTICABLE_PROPS,
  DEFAULT_ADMIN_CREDENTIALS,
  DUMMY_FILE_NAME,
  DUMMY_IMAGE_NAME
} from '../../constants'

import { StorageService } from '../../storage/services/storage.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

@Injectable()
export class SeederService {
  seededFiles: { [key: string]: string } = {}
  seededImages: { [key: string]: { [key: string]: string } } = {}

  constructor(
    private entityService: EntityService,
    private relationshipService: RelationshipService,
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

    const dbConnection: DatabaseConnection = this.dataSource.options
      .type as DatabaseConnection

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
            queryRunner
              .query(`DELETE FROM [${entity.tableName}]`)
              .then(() =>
                queryRunner.query(
                  `DELETE FROM sqlite_sequence WHERE name = '${entity.tableName}'`
                )
              )
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
        await this.seedAdmin(repository)
        continue
      }

      const entityManifest: EntityManifest =
        this.entityManifestService.getEntityManifest({
          className: entityMetadata.name,
          fullVersion: true
        })

      // Prevent logging during tests.
      if (process.env.NODE_ENV !== 'test') {
        if (entityManifest.single) {
          console.log(
            `✅ Seeding ${entityManifest.seedCount || 'single'} ${entityManifest.nameSingular}...`
          )
        } else {
          console.log(
            `✅ Seeding ${entityManifest.seedCount} ${entityManifest.seedCount > 1 ? entityManifest.namePlural : entityManifest.nameSingular}...`
          )
        }
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
        this.entityManifestService.getEntityManifest({
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

    const filePath: string = await this.storageService.store(
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
      await this.storageService.storeImage(
        entityManifest.slug,
        propertyManifest.name,
        {
          originalname: DUMMY_FILE_NAME,
          buffer: dummyImageContent
        },
        propertyManifest.options?.['sizes'] as ImageSizesObject
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
  async seedAdmin(repository: Repository<BaseEntity>): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(
        `✅ Seeding default admin ${DEFAULT_ADMIN_CREDENTIALS.email} with password "${DEFAULT_ADMIN_CREDENTIALS.password}"...`
      )
    }

    const admin: AuthenticableEntity =
      repository.create() as AuthenticableEntity
    admin.email = DEFAULT_ADMIN_CREDENTIALS.email
    admin.password = bcrypt.hashSync(DEFAULT_ADMIN_CREDENTIALS.password, 1)

    await repository.save(admin)
  }
}
