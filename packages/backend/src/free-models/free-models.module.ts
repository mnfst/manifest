import { Module } from '@nestjs/common';
import { FreeModelsController } from './free-models.controller';
import { FreeModelsService } from './free-models.service';
import { FreeModelsSyncService } from './free-models-sync.service';

@Module({
  controllers: [FreeModelsController],
  providers: [FreeModelsService, FreeModelsSyncService],
  exports: [FreeModelsSyncService, FreeModelsService],
})
export class FreeModelsModule {}
