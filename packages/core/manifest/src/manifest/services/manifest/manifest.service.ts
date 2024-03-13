import { Injectable } from '@nestjs/common'
import {
  AppManifest,
  EntityManifest,
  PropertyManifest
} from '../../typescript/manifest-types'
import { SchemaService } from '../schema/schema.service'
import { YamlService } from '../yaml/yaml.service'

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
   * Load the entities from the manifest.
   *
   * @returns The entities.
   *
   * */
  getEntityManifests(): { [className: string]: EntityManifest } {
    const manifest: AppManifest = this.getAppManifest()
    return manifest.entities
  }

  /**
   * Load an entity from the manifests.
   *
   * @param className The class name of the entity to load.
   * @param fillDefaults Whether to fill in the defaults for the entity.
   *
   * @returns The entity manifest.
   *
   * */
  getEntityManifest({
    className,
    fillDefaults
  }: {
    className: string
    fillDefaults?: boolean
  }): EntityManifest {
    const entities: { [className: string]: EntityManifest } =
      this.getEntityManifests()

    if (!entities[className]) {
      throw new Error(`Entity ${className} not found in manifest`)
    }

    if (!fillDefaults) {
      return entities[className]
    }
    return this.fillInEntityManifestDefaults(className, entities[className])
  }

  /**
   * Fill in the defaults for an entity.
   *
   * @param className The class name of the entity.
   * @param entity The entity to fill in the defaults for.
   *
   * @returns The entity with defaults filled in.
   *
   * */
  fillInEntityManifestDefaults(
    className: string,
    entityManifest: EntityManifest
  ): EntityManifest {
    return {
      name: entityManifest.name || className,
      nameSingular:
        entityManifest.nameSingular ||
        pluralize.singular(entityManifest.name || className).toLowerCase(),
      namePlural:
        entityManifest.namePlural ||
        pluralize.plural(entityManifest.name || className).toLowerCase(),
      slug:
        entityManifest.slug ||
        slugify(
          dasherize(
            pluralize.plural(entityManifest.name || className)
          ).toLowerCase()
        ),
      // First "string" property found in the entity if exists, otherwise "id".
      mainProp:
        entityManifest.mainProp ||
        Object.entries(entityManifest.properties).find(
          ([_propName, propManifest]: [string, PropertyManifest]) =>
            propManifest.type === 'string'
        )?.[0] ||
        'id',
      seedCount: entityManifest.seedCount || entityManifestDefaults.seedCount,
      ...entityManifest
    }
  }
}
