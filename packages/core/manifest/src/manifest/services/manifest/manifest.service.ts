import { Injectable } from '@nestjs/common'
import { Entity, ManifestYML } from '../../typescript/manifest-types'
import { SchemaService } from '../schema/schema.service'
import { YamlService } from '../yaml/yaml.service'

@Injectable()
export class ManifestService {
  constructor(
    private yamlService: YamlService,
    private schemaService: SchemaService
  ) {}

  loadManifest(): ManifestYML {
    const manifest: ManifestYML = this.yamlService.load()

    this.schemaService.validate(manifest)

    return manifest
  }

  loadEntities(): { [key: string]: Entity } {
    const manifest: ManifestYML = this.loadManifest()
    return manifest.entities
  }
}
