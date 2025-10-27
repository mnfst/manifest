import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common'
import { ManifestWriterService } from '../services/manifest-writer.service'
import { CreateUpdateEntityManifestDto } from '../dtos/create-update-entity-manifest.dto'

@Controller('manifest-writer')
export class ManifestWriterController {
  constructor(private readonly manifestWriterService: ManifestWriterService) {}

  @Post('entities')
  createEntity(
    @Body() entityDto: CreateUpdateEntityManifestDto
  ): Promise<{ success: boolean }> {
    return this.manifestWriterService.createEntityManifest(entityDto)
  }

  @Put('entities/:className')
  updateEntity(
    @Param('className') className: string,
    @Body() entityDto: CreateUpdateEntityManifestDto
  ): Promise<{ success: boolean }> {
    return this.manifestWriterService.updateEntityManifest(className, entityDto)
  }

  @Delete('entities/:className')
  deleteEntity(
    @Param('className') className: string
  ): Promise<{ success: boolean }> {
    return this.manifestWriterService.deleteEntityManifest(className)
  }
}
