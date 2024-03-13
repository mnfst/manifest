import { Module } from '@nestjs/common'
import { EntityLoaderService } from './services/entity-loader/entity-loader.service'
import { EntityMetaService } from './services/entity-meta/entity-meta.service'

@Module({
  providers: [EntityLoaderService, EntityMetaService],
  exports: [EntityLoaderService, EntityMetaService]
})
export class EntityModule {}
