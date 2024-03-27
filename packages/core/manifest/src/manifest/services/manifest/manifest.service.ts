import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { SchemaService } from '../schema/schema.service'
import { YamlService } from '../yaml/yaml.service'

import {
  AppManifest,
  AppManifestSchema,
  EntityManifest,
  EntityManifestSchema,
  PropType,
  PropertyManifest,
  PropertyManifestSchema,
  RelationshipManifest,
  RelationshipManifestSchema
} from '@casejs/types'
import dasherize from 'dasherize'
import pluralize from 'pluralize'
import slugify from 'slugify'
import { entityManifestDefaults } from './manifest.defaults'

@Injectable()
export class ManifestService {
  constructor(
    private yamlService: YamlService,
    private schemaService: SchemaService
  ) {}

  /**
   * Load the manifest from the file, validate it and transform it.
   *
   * @param publicVersion Whether to return the public version of the manifest.THe public version is the one that is exposed to the client: it hides settings and the hidden properties.
   *
   *
   * @returns The manifest.
   *
   * */
  getAppManifest(options?: { publicVersion?: boolean }): AppManifest {
    const manifestSchema: AppManifestSchema = this.yamlService.load()

    this.schemaService.validate(manifestSchema)

    const appManifest: AppManifest = this.transformAppManifest(manifestSchema)

    if (options?.publicVersion) {
      return this.hideSensitiveInformation(appManifest)
    }
    return appManifest
  }

  /**
   * Load the entities from the manifest and fill in the defaults.
   *
   * @returns The entity manifests.
   *
   * */
  getEntityManifests(): EntityManifest[] {
    const manifestSchema: AppManifestSchema = this.yamlService.load()

    return Object.entries(manifestSchema.entities).map(
      ([className, entity]: [string, EntityManifestSchema]) =>
        this.transformEntity(className, entity)
    )
  }

  /**
   * Load a single entity from the manifest and fill in the defaults.
   *
   * @param className The class name of the entity to load.
   * @param slug The slug of the entity to load.
   *
   * @returns The entity manifest.
   *
   * */
  getEntityManifest({
    className,
    slug,
    publicVersion
  }: {
    className?: string
    slug?: string
    publicVersion?: boolean
  }): EntityManifest {
    if (!className && !slug) {
      throw new HttpException(
        `Either className or slug must be provided`,
        HttpStatus.BAD_REQUEST
      )
    }

    const entities: EntityManifest[] = this.getEntityManifests()

    let entityManifest: EntityManifest

    if (className) {
      entityManifest = entities.find((entity) => entity.className === className)
    } else {
      entityManifest = entities.find((entity) => entity.slug === slug)
    }

    if (!entityManifest) {
      throw new HttpException(
        `Entity ${className || slug} not found in manifest`,
        HttpStatus.NOT_FOUND
      )
    }

    if (publicVersion) {
      return this.hideEntitySensitiveInformation(entityManifest)
    }

    return entityManifest
  }

  /**
   * Transform an AppManifestSchema into an AppManifest.
   *
   * @param manifestSchema the manifest schema to transform.
   * @returns the manifest with defaults filled in and short form properties transformed into long form.
   */
  transformAppManifest(manifestSchema: AppManifestSchema): AppManifest {
    return {
      ...manifestSchema,
      entities: Object.entries(manifestSchema.entities).reduce(
        (
          acc: { [k: string]: EntityManifest },
          [className, entityManifestSchema]: [string, EntityManifestSchema]
        ) => {
          acc[className] = this.transformEntity(className, entityManifestSchema)
          return acc
        },
        {}
      )
    } as AppManifest
  }

  /**
   *
   * Transform an EntityManifestSchema into an EntityManifest ensuring that undefined properties are filled in with defaults
   * and short form properties are transformed into long form.
   *
   * @param className the class name of the entity.
   * @param entityManifest the entity manifest to transform.
   *
   * @returns the entity manifest with defaults filled in and short form properties transformed into long form.
   */
  transformEntity(
    className: string,
    entityManifestSchema: EntityManifestSchema
  ): EntityManifest {
    const properties: PropertyManifest[] = (
      entityManifestSchema.properties || []
    ).map((propManifest: PropertyManifestSchema) =>
      this.transformProperty(propManifest)
    )

    const entityManifest: EntityManifest = {
      className: entityManifestSchema.className || className,
      nameSingular:
        entityManifestSchema.nameSingular ||
        pluralize
          .singular(entityManifestSchema.className || className)
          .toLowerCase(),
      namePlural:
        entityManifestSchema.namePlural ||
        pluralize
          .plural(entityManifestSchema.className || className)
          .toLowerCase(),
      slug:
        entityManifestSchema.slug ||
        slugify(
          dasherize(
            pluralize.plural(entityManifestSchema.className || className)
          ).toLowerCase()
        ),
      // First "string" property found in the entity if exists, otherwise "id".
      mainProp:
        entityManifestSchema.mainProp ||
        properties.find((prop) => prop.type === PropType.String)?.name ||
        'id',
      seedCount:
        entityManifestSchema.seedCount || entityManifestDefaults.seedCount,
      belongsTo: (entityManifestSchema.belongsTo || []).map(
        (relationship: RelationshipManifestSchema) =>
          this.transformRelationship(relationship)
      ),
      properties
    }

    return entityManifest
  }

  /**
   *
   * Transform the short form of the relationship into the long form.
   *
   * @param relationship the relationship that can include short form properties.
   * @returns the relationship with the short form properties transformed into long form.
   */
  transformRelationship(
    relationship: RelationshipManifestSchema
  ): RelationshipManifest {
    if (typeof relationship === 'string') {
      return {
        name: relationship.toLowerCase(),
        entity: relationship,
        eager: false
      }
    }
    return {
      name: relationship.name || relationship.entity.toLowerCase(),
      entity: relationship.entity,
      eager: relationship.eager || false
    }
  }

  /**
   *
   * Transform the short form of the property into the long form.
   *
   * @param propManifest the property that can be in short form.
   * @returns the property with the short form properties transformed into long form.
   *
   */
  transformProperty(
    propManifestSchema: PropertyManifestSchema
  ): PropertyManifest {
    if (typeof propManifestSchema === 'string') {
      return {
        name: propManifestSchema.toLowerCase(),
        type: PropType.String,
        hidden: false
      }
    }
    return {
      name: propManifestSchema.name,
      type: (propManifestSchema.type as PropType) || PropType.String,
      hidden: propManifestSchema.hidden || false
    }
  }

  /**
   * Hide sensitive information from the manifest to be sent to the client.
   *
   * @param manifest The manifest to save.
   *
   * @returns The manifest with sensitive information hidden.
   *
   * */
  hideSensitiveInformation(manifest: AppManifest): AppManifest {
    return {
      ...manifest,
      entities: Object.entries(manifest.entities).reduce(
        (
          acc: { [k: string]: EntityManifest },
          [className, entity]: [string, EntityManifest]
        ) => {
          // TODO: Seed count should be hidden in the public version of the manifest.
          const { seedCount, ...publicEntity } = entity

          acc[className] = this.hideEntitySensitiveInformation(publicEntity)
          return acc
        },
        {}
      )
    }
  }

  /**
   * Hide entity sensitive information from the manifest to be sent to the client.
   *
   * @param entityManifest The entity manifest.
   *
   * @returns The entity manifest with sensitive information hidden.
   */
  hideEntitySensitiveInformation(
    entityManifest: EntityManifest
  ): EntityManifest {
    return {
      ...entityManifest,
      properties: entityManifest.properties
        .filter((prop) => !prop.hidden)
        .map((prop) => ({
          name: prop.name,
          type: prop.type
        }))
    }
  }
}
