import { Module } from '@nestjs/common'
import { StorageService } from './services/storage.service'
import { StorageController } from './storage.controller'

@Module({
  providers: [StorageService],
  exports: [StorageService],
  controllers: [StorageController]
})
export class StorageModule {}
