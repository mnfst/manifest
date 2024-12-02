import { Module } from '@nestjs/common'
import { UploadController } from './controllers/upload.controller'
import { StorageService } from '../storage/services/storage/storage.service'
import { ManifestModule } from '../manifest/manifest.module'
import { StorageModule } from '../storage/storage.module'
import { UploadService } from './services/upload.service'

@Module({
  imports: [ManifestModule, StorageModule],
  controllers: [UploadController],
  providers: [StorageService, UploadService]
})
export class UploadModule {}
