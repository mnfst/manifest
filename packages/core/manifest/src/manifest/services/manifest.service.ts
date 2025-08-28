import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { SchemaService } from './schema.service'
import { YamlService } from './yaml.service'

import {
  AppManifest,
  Manifest,
  EntityManifest,
  EntitySchema,
  AppEnvironment
} from '@repo/types'

import { ADMIN_ENTITY_MANIFEST } from '../../constants'
import { EntityManifestService } from './entity-manifest.service'
import { EndpointService } from '../../endpoint/endpoint.service'
import { ConfigService } from '@nestjs/config'
import { LockFileService } from './lock-file.service'

@Injectable()
export class ManifestService {
  private appManifest: AppManifest
  private loadingPromise: Promise<AppManifest> | null = null

  constructor(
    private yamlService: YamlService,
    private schemaService: SchemaService,
    @Inject(forwardRef(() => EntityManifestService))
    private entityManifestService: EntityManifestService,
    private endpointService: EndpointService,
    private readonly configService: ConfigService,
    private readonly lockFileService: LockFileService
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
   * Load the manifest from the file and store it in the service. Prevents multiple loads at the same time by returning a promise that resolves when the manifest is loaded.
   *
   * @param manifestFilePath The path to the manifest file.
   *
   * @returns void
   *
   **/
  async loadManifest(manifestFilePath: string): Promise<AppManifest> {
    if (this.loadingPromise) {
      return this.loadingPromise
    }

    return this.doLoadManifest(manifestFilePath)
  }

  /**
   * Load the manifest from the file, validate it and transform it to store it in the service.
   *
   * @param manifestFilePath The path to the manifest file.
   *
   * @returns A promise that resolves when the manifest is loaded.
   *
   **/
  async doLoadManifest(manifestFilePath: string): Promise<AppManifest> {
    const appSchema: Manifest = await this.yamlService.load({
      manifestFilePath
    })

    this.schemaService.validate(appSchema)

    const appManifest: AppManifest = {
      name: appSchema.name || 'Manifest App',
      version: appSchema.version || '1.0.0',
      manifestVersion: this.lockFileService.getInstalledVersion('manifest'),
      environment:
        this.configService.get<AppEnvironment>('NODE_ENV') || 'development',
      entities: this.entityManifestService
        .transformEntityManifests({
          entities: appSchema.entities || {},
          groups: appSchema.groups || {}
        })
        .reduce((acc, entityManifest: EntityManifest) => {
          acc[entityManifest.className] = entityManifest
          return acc
        }, {}),
      endpoints: this.endpointService.transformEndpointsSchemaObject(
        appSchema.endpoints
      ),
      settings: appSchema.settings || {}
    }

    // Disable telemetry if the environment variable is set.
    if (this.configService.get<boolean>('MANIFEST_TELEMETRY_DISABLED')) {
      appManifest.disableTelemetry = true
    }

    // Add Admin entity.
    appManifest.entities.Admin = ADMIN_ENTITY_MANIFEST

    this.appManifest = appManifest

    return this.appManifest
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
