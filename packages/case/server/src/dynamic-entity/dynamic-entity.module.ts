import { Module } from '@nestjs/common'

import { AuthService } from '../auth/auth.service'
import { FileUploadService } from '../file-upload/file-upload.service'
import { ImageUploadService } from '../file-upload/image-upload.service'
import { DynamicEntityController } from './dynamic-entity.controller'
import { DynamicEntitySeeder } from './dynamic-entity.seeder'
import { DynamicEntityService } from './dynamic-entity.service'
/**
 * Module for handling dynamic entities
 * @module DynamicEntityModule
 */
@Module({
  controllers: [DynamicEntityController],
  providers: [
    DynamicEntityService,
    DynamicEntitySeeder,
    AuthService,
    FileUploadService,
    ImageUploadService
  ]
})
export class DynamicEntityModule {}
