import { Module } from '@nestjs/common'
import { UploadController } from './controllers/upload/upload.controller'
import { StorageService } from './services/storage.service'
import { ManifestModule } from '../manifest/manifest.module'

@Module({
  imports: [ManifestModule],
  controllers: [UploadController],
  providers: [StorageService]
})
export class UploadModule {}
