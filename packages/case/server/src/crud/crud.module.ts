import { Module } from '@nestjs/common'

import { AuthService } from '../auth/auth.service'
import { FileUploadService } from '../file-upload/file-upload.service'
import { ImageUploadService } from '../file-upload/image-upload.service'
import { CrudController } from './controllers/crud.controller'
import { CrudSeeder } from './crud.seeder'
import { CrudService } from './services/crud.service'
import { EntityMetaService } from './services/entity-meta.service'

@Module({
  controllers: [CrudController],
  providers: [
    CrudService,
    EntityMetaService,
    AuthService,
    FileUploadService,
    ImageUploadService,
    CrudSeeder
  ]
})
export class CrudModule {}
