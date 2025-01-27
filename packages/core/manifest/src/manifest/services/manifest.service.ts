import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { SchemaService } from './schema.service'
import { YamlService } from './yaml.service'

import {
  AppManifest,
  Manifest,
  EntityManifest,
  EntitySchema
} from '@repo/types'

import { ADMIN_ENTITY_MANIFEST } from '../../constants'
import { EntityManifestService } from './entity-manifest.service'
import { EndpointService } from '../../endpoint/endpoint.service'

@Injectable()
export class ManifestService {
  private appManifest: AppManifest

  constructor(
    private yamlService: YamlService,
    private schemaService: SchemaService,
    @Inject(forwardRef(() => EntityManifestService))
    private entityManifestService: EntityManifestService,
    private endpointService: EndpointService
  ) {}

  /**
   * Get the manifest.
   *
   * @param fullVersion Whether to return the public version of the manifest.THe public version is the one that is exposed to the client: it hides settings and the hidden properties.
   *
   * @returns The manifest.
   *
   **/
  getAppManifest(options?: { fullVersion?: boolean }): AppManifest {
    if (!this.appManifest) {
      throw new Error('Manifest not loaded')
    }

    if (!options?.fullVersion) {
      return this.hideSensitiveInformation(this.appManifest)
    }

    return this.appManifest
  }

  /**
   * Load the manifest from the file, validate it and transform it to store it in the service.
   *
   * @param manifestFilePath The path to the manifest file.
   *
   * @returns void
   *
   **/
  async loadManifest(manifestFilePath: string): Promise<void> {
    const appSchema: Manifest = await this.yamlService.load(manifestFilePath)

    this.schemaService.validate(appSchema)

    const appManifest: AppManifest = {
      ...appSchema,
      version: appSchema.version || '0.0.1',
      entities: this.entityManifestService
        .transformEntityManifests(appSchema.entities)
        .reduce((acc, entityManifest: EntityManifest) => {
          acc[entityManifest.className] = entityManifest
          return acc
        }, {}),
      endpoints: this.endpointService.transformEndpointsSchemaObject(
        appSchema.endpoints
      )
    }

    // Add Admin entity.
    appManifest.entities.Admin = ADMIN_ENTITY_MANIFEST

    this.appManifest = appManifest
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
      entities: Object.entries(manifest.entities)
        .filter(
          ([className]: [string, EntitySchema]) =>
            className !== ADMIN_ENTITY_MANIFEST.className
        )
        .reduce(
          (
            acc: { [k: string]: EntityManifest },
            [className, entity]: [string, EntityManifest]
          ) => {
            const { ...publicEntity } = entity

            acc[className] =
              this.entityManifestService.hideEntitySensitiveInformation(
                publicEntity
              )
            return acc
          },
          {}
        )
    }
  }
}
