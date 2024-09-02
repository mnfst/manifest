import { Module, forwardRef } from '@nestjs/common'
import { ManifestModule } from '../manifest/manifest.module'
import { EntityLoaderService } from './services/entity-loader.service'
import { EntityService } from './services/entity.service'
import { PropertyService } from './services/property.service'
import { RelationshipService } from './services/relationship.service'

@Module({
  imports: [forwardRef(() => ManifestModule)],
  providers: [
    EntityLoaderService,
    EntityService,
    PropertyService,
    RelationshipService
  ],
  exports: [
    EntityLoaderService,
    EntityService,
    PropertyService,
    RelationshipService
  ]
})
export class EntityModule {}
