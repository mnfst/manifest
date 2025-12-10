import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { CreateUpdateEntityManifestDto } from '../dtos/create-update-entity-manifest.dto'
import { YamlService } from './yaml.service'
import { Manifest } from '../../../../types/src'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ManifestWriterService {
  constructor(
    private readonly yamlService: YamlService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Create a new Manifest Entity and save it to the Manifest file.
   *
   * @param entityDto The data transfer object containing the entity details.
   * @returns A success message.
   */
  async createEntityManifest(
    entityDto: CreateUpdateEntityManifestDto
  ): Promise<{ success: boolean }> {
    const manifestFilePath: string =
      this.configService.get('paths').manifestFile

    // Fetch Manifest
    const manifestSchema: Manifest = await this.yamlService.load({
      manifestFilePath
    })

    if (manifestSchema.entities[entityDto.className]) {
      throw new HttpException(
        `Entity with className ${entityDto.className} already exists in the manifest.`,
        HttpStatus.CONFLICT
      )
    }

    manifestSchema.entities[entityDto.className] = {
      className: entityDto.className,
      slug: entityDto.slug,
      properties: entityDto.properties
    }

    return this.yamlService.saveFileContent(manifestSchema)
  }

  /**
   * Update an existing Manifest Entity in the Manifest file.
   *
   * @param className The class name of the entity to be updated.
   * @param entityDto The data transfer object containing the updated entity details.
   * @returns A success message.
   */
  async updateEntityManifest(
    className: string,
    entityDto: CreateUpdateEntityManifestDto
  ): Promise<{ success: boolean }> {
    const manifestFilePath: string =
      this.configService.get('paths').manifestFile

    // Fetch Manifest.
    const manifestSchema: Manifest = await this.yamlService.load({
      manifestFilePath
    })

    if (!manifestSchema.entities[className]) {
      throw new Error(
        `Entity with className ${className} does not exist in the manifest.`
      )
    }

    manifestSchema.entities[className] = {
      ...manifestSchema.entities[className],
      ...entityDto
    }

    return this.yamlService.saveFileContent(manifestSchema)
  }

  /**
   * Delete a Manifest Entity from the Manifest file.
   *
   * @param className The class name of the entity to be deleted.
   * @returns A success message.
   */
  async deleteEntityManifest(className: string): Promise<{ success: boolean }> {
    const manifestFilePath: string =
      this.configService.get('paths').manifestFile

    // Fetch Manifest
    const manifestSchema: Manifest = await this.yamlService.load({
      manifestFilePath
    })

    if (!manifestSchema.entities[className]) {
      throw new HttpException(
        `Entity with className ${className} does not exist in the manifest.`,
        HttpStatus.NOT_FOUND
      )
    }

    delete manifestSchema.entities[className]

    return this.yamlService.saveFileContent(manifestSchema)
  }
}
