import { Module } from '@nestjs/common'
import { ManifestModule } from '../manifest/manifest.module'
import { EntityLoaderService } from './services/entity-loader/entity-loader.service'
import { EntityService } from './services/entity/entity.service'
import { PropertyService } from './services/property/property.service'

@Module({
  imports: [ManifestModule],
  providers: [EntityLoaderService, EntityService, PropertyService],
  exports: [EntityLoaderService, EntityService, PropertyService]
})
export class EntityModule {}
