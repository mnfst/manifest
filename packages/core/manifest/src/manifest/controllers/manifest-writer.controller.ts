import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common'
import { ManifestWriterService } from '../services/manifest-writer.service'
import { CreateUpdateManifestEntityDto } from '../dtos/create-update-manifest-entity.dto'

@Controller('manifest-writer')
export class ManifestWriterController {
  constructor(private readonly manifestWriterService: ManifestWriterService) {}

  @Post('entities')
  createEntity(
    @Body() entityDto: CreateUpdateManifestEntityDto
  ): Promise<{ success: boolean }> {
    return this.manifestWriterService.createManifestEntity(entityDto)
  }

  @Put('entities')
  updateEntity(
    @Body() entityDto: CreateUpdateManifestEntityDto
  ): Promise<{ success: boolean }> {
    return this.manifestWriterService.updateManifestEntity(entityDto)
  }

  @Delete('entities/:className')
  deleteEntity(
    @Param('className') className: string
  ): Promise<{ success: boolean }> {
    return this.manifestWriterService.deleteManifestEntity(className)
  }
}
