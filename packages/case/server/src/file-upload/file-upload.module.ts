import { Module } from '@nestjs/common'

import { EntityMetaService } from '../crud/services/entity-meta.service'
import { FileUploadController } from './file-upload.controller'
import { FileUploadService } from './file-upload.service'
import { ImageUploadService } from './image-upload.service'

@Module({
  controllers: [FileUploadController],
  providers: [FileUploadService, ImageUploadService, EntityMetaService]
})
export class FileUploadModule {}
