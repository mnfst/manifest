import {
  AuthenticableEntity,
  BaseEntity,
  EntityManifest,
  ImageSizesObject,
  PropType,
  PropertyManifest,
  RelationshipManifest
} from '@repo/types'
import { SHA3 } from 'crypto-js'
import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, QueryRunner, Repository } from 'typeorm'
import { EntityService } from '../../entity/services/entity.service'
import { RelationshipService } from '../../entity/services/relationship.service'

import { faker } from '@faker-js/faker'
import * as fs from 'fs'
import * as path from 'path'

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
  seededFiles: { [key: string]: string | object } = {}

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
    const isPostgres = this.dataSource.options.type === 'postgres'

    if (isPostgres) {
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
    } else {
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
        console.log(
          `✅ Seeding ${entityManifest.seedCount} ${entityManifest.seedCount > 1 ? entityManifest.namePlural : entityManifest.nameSingular}...`
        )
      }

      for (const _index of Array(entityManifest.seedCount).keys()) {
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
    switch (propertyManifest.type) {
      case PropType.String:
        return faker.commerce.product()
      case PropType.Number:
        return faker.number.int({ max: 50 })
      case PropType.Link:
        return 'https://manifest.build'
      case PropType.Text:
        return faker.commerce.productDescription()
      case PropType.RichText:
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
      case PropType.Money:
        return faker.finance.amount({
          min: 1,
          max: 500,
          dec: 2
        })
      case PropType.Date:
        return faker.date.past()
      case PropType.Timestamp:
        return faker.date.recent()
      case PropType.Email:
        return faker.internet.email()
      case PropType.Boolean:
        return faker.datatype.boolean()
      case PropType.Password:
        return SHA3('manifest').toString()
      case PropType.Choice:
        return faker.helpers.arrayElement(
          propertyManifest.options.values as unknown[]
        )
      case PropType.Location:
        return {
          lat: faker.location.latitude(),
          lng: faker.location.longitude()
        }
      case PropType.File:
        // Prevent seeding the same file multiple times.
        if (
          this.seededFiles[`${entityManifest.slug}.${propertyManifest.name}`]
        ) {
          return this.seededFiles[
            `${entityManifest.slug}.${propertyManifest.name}`
          ]
        }

        const filePath: string = await this.seedFile(
          entityManifest.slug,
          propertyManifest.name
        )
        this.seededFiles[`${entityManifest.slug}.${propertyManifest.name}`] =
          filePath
        return filePath

      case PropType.Image:
        // Prevent seeding the same file multiple times.
        if (
          this.seededFiles[`${entityManifest.slug}.${propertyManifest.name}`]
        ) {
          return this.seededFiles[
            `${entityManifest.slug}.${propertyManifest.name}`
          ]
        }

        const images: { [key: string]: string } = await this.seedImage(
          entityManifest.slug,
          propertyManifest.name,
          propertyManifest.options?.['sizes'] as ImageSizesObject
        )
        this.seededFiles[`${entityManifest.slug}.${propertyManifest.name}`] =
          images

        return images
    }
  }

  /**
   * Seed the Admin table with default credentials. Only one admin user is created.
   *
   * @param repository The repository for the Admin entity.
   */
  async seedAdmin(repository: Repository<BaseEntity>): Promise<void> {
    const admin: AuthenticableEntity =
      repository.create() as AuthenticableEntity
    admin.email = DEFAULT_ADMIN_CREDENTIALS.email
    admin.password = SHA3(DEFAULT_ADMIN_CREDENTIALS.password).toString()

    await repository.save(admin)
  }

  /**
   * Seed a dummy file.
   *
   * @param entity The entity name.
   * @param property The property name.
   *
   * @returns The file path.
   * */
  async seedFile(entity: string, property: string): Promise<string> {
    const dummyFileContent = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'assets', DUMMY_FILE_NAME)
    )

    const filePath: string = await this.storageService.store(entity, property, {
      originalname: DUMMY_FILE_NAME,
      buffer: dummyFileContent
    })

    return filePath
  }

  /**
   * Seed a dummy image.
   *
   * @param entity The entity name.
   * @param property The property name.
   * @param sizes The image sizes.
   *
   * @returns The image path.
   * */
  seedImage(
    entity: string,
    property: string,
    sizes?: ImageSizesObject
  ): Promise<{ [key: string]: string }> {
    const dummyImageContent = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'assets', DUMMY_IMAGE_NAME)
    )

    return this.storageService.storeImage(
      entity,
      property,
      {
        originalname: DUMMY_FILE_NAME,
        buffer: dummyImageContent
      },
      sizes
    )
  }
}
