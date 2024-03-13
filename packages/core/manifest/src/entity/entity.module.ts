import { Module } from '@nestjs/common'
import { EntityLoaderService } from './services/entity-loader/entity-loader.service'

@Module({
  providers: [EntityLoaderService],
  exports: [EntityLoaderService]
})
export class EntityModule {}
