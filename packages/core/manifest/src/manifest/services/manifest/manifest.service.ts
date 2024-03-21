import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { AppManifest, EntityManifest } from '../../typescript/manifest-types'
import { SchemaService } from '../schema/schema.service'
import { YamlService } from '../yaml/yaml.service'

import dasherize from 'dasherize'
import pluralize from 'pluralize'
import slugify from 'slugify'
import { DetailedPropertyManifest } from '../../typescript/other/detailed-property-manifest.type'
import { entityManifestDefaults } from './manifest.defaults'

@Injectable()
export class ManifestService {
  constructor(
    private yamlService: YamlService,
    private schemaService: SchemaService
  ) {}

  /**
   * Load the manifest from the manifest.yml file and validate it.
   *
   * @returns The manifest.
   *
   * */
  getAppManifest(): AppManifest {
    const manifest: AppManifest = this.yamlService.load()

    this.schemaService.validate(manifest)

    return manifest
  }

  /**
   * Load the entities from the manifest and fill in the defaults.
   *
   * @returns The entities.
   *
   * */
  getEntityManifests(): EntityManifest[] {
    const manifest: AppManifest = this.getAppManifest()

    return Object.entries(manifest.entities).map(
      ([className, entity]: [string, EntityManifest]) =>
        this.fillInEntityManifestDefaults(className, entity)
    )
  }

  /**
   * Load an entity from the manifest and fill in the defaults.
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
        `Entity ${className} not found in manifest`,
        HttpStatus.NOT_FOUND
      )
    }

    return entityManifest
  }

  /**
   * Fill in the defaults for an entity.
   *
   * @param entityManifest The entity to fill in the defaults for.
   *
   * @returns The entity manifest with defaults filled in.
   *
   * */
  fillInEntityManifestDefaults(
    className: string,
    entityManifest: EntityManifest
  ): EntityManifest {
    return {
      className: entityManifest.className || className,
      nameSingular:
        entityManifest.nameSingular ||
        pluralize.singular(entityManifest.className || className).toLowerCase(),
      namePlural:
        entityManifest.namePlural ||
        pluralize.plural(entityManifest.className || className).toLowerCase(),
      slug:
        entityManifest.slug ||
        slugify(
          dasherize(
            pluralize.plural(entityManifest.className || className)
          ).toLowerCase()
        ),
      // First "string" property found in the entity if exists, otherwise "id".
      mainProp:
        entityManifest.mainProp ||
        Object.entries(entityManifest.properties).find(
          ([_propName, propManifest]: [string, DetailedPropertyManifest]) =>
            propManifest.type === 'string'
        )?.[0] ||
        'id',
      seedCount: entityManifest.seedCount || entityManifestDefaults.seedCount,
      properties: entityManifest.properties || [],
      belongsTo: entityManifest.belongsTo || [],
      ...entityManifest
    }
  }
}
