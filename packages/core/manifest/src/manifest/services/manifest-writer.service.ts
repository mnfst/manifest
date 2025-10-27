import { Injectable } from '@nestjs/common'
import { CreateManifestEntityDto } from '../dtos/create-manifest-entity.dto'
import { YamlService } from './yaml.service'
import { Manifest } from '../../../../types/src'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ManifestWriterService {
  constructor(
    private readonly yamlService: YamlService,
    private readonly configService: ConfigService
  ) {}

  async createManifestEntity(entityDto: CreateManifestEntityDto) {
    const manifestFilePath: string =
      this.configService.get('paths').manifestFile

    // Fetch Manifest
    const manifestSchema: Manifest = await this.yamlService.load({
      manifestFilePath
    })

    manifestSchema.entities[entityDto.className] = {
      className: entityDto.className,
      slug: entityDto.slug
    }

    return this.yamlService.saveFileContent(manifestFilePath, {
      manifestSchema
    })
  }

  updateManifestEntity() {}

  deleteManifestEntity() {}
}
