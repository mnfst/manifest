import { Injectable } from '@nestjs/common'
import { SchemaService } from '../schema/schema.service'
import { YamlService } from '../yaml/yaml.service'

@Injectable()
export class ManifestService {
  constructor(
    private yamlService: YamlService,
    private schemaService: SchemaService
  ) {}

  load(): Object {
    const manifest = this.yamlService.load()

    const valid = this.schemaService.validate(manifest)

    if (!valid) {
      throw new Error('Manifest file is invalid')
    }

    return manifest
  }

  loadEntities() {
    const manifest = this.load()

    return manifest['entities']
  }
}
