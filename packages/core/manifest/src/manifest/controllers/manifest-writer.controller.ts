import { Body, Controller, Post } from '@nestjs/common'
import { ManifestWriterService } from '../services/manifest-writer.service'
import { CreateManifestEntityDto } from '../dtos/create-manifest-entity.dto'

@Controller('manifest-writer')
export class ManifestWriterController {
  constructor(private readonly manifestWriterService: ManifestWriterService) {}

  @Post('entities')
  createEntity(@Body() entityDto: CreateManifestEntityDto) {
    return this.manifestWriterService.createManifestEntity(entityDto)
  }
}
