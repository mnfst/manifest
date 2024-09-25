import { Module } from '@nestjs/common'
import { UploadController } from './controllers/upload/upload.controller'
import { StorageService } from './services/storage.service'

@Module({
  controllers: [UploadController],
  providers: [StorageService]
})
export class UploadModule {}
