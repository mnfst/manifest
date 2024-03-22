import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { SchemaService } from '../schema/schema.service'
import { YamlService } from '../yaml/yaml.service'

import { PropType } from '@casejs/types'
import { AppManifest } from '@casejs/types/src/manifests/app-manifest.interface'
import { EntityManifest } from '@casejs/types/src/manifests/entity-manifest.interface'
import {
  AppManifestSchema,
  EntityManifestSchema,
  PropertyManifestSchema,
  RelationshipManifestSchema
} from '@casejs/types/src/manifests/manifest-types'
import { PropertyManifest } from '@casejs/types/src/manifests/property-manifest.type'
import { RelationshipManifest } from '@casejs/types/src/manifests/relationship-manifest.type'
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
   * @returns The manifest.
   *
   * */
  getAppManifest(): AppManifest {
    const manifestSchema: AppManifestSchema = this.yamlService.load()

    this.schemaService.validate(manifestSchema)

    return this.transformAppManifest(manifestSchema)
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
    slug
  }: {
    className?: string
    slug?: string
  }): EntityManifest {
    if (!className && !slug) {
      throw new Error(`Either className or slug must be provided`)
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
      entities: Object.entries(manifestSchema.entities).reduce(
        (
          acc: { [k: string]: EntityManifest },
          [className, entityManifestSchema]: [string, EntityManifestSchema]
        ) => {
          acc[className] = this.transformEntity(className, entityManifestSchema)
          return acc
        },
        {}
      ),
      ...manifestSchema
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
}
