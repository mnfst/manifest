import { Module, forwardRef } from '@nestjs/common'
import { EntityModule } from '../entity/entity.module'
import { ManifestController } from './controllers/manifest.controller'
import { SchemaService } from './services/schema.service'
import { YamlService } from './services/yaml.service'
import { AuthModule } from '../auth/auth.module'
import { EntityManifestService } from './services/entity-manifest.service'
import { RelationshipManifestService } from './services/relationship-manifest.service'
import { ManifestService } from './services/manifest.service'
import { HookModule } from '../hook/hook.module'

/**
 *
 * The ManifestModule is a global module that provides services for working with the manifest file(s).
 * The module exports the ManifestService, which is used to load the manifest file(s).
 *
 */

@Module({
  imports: [
    forwardRef(() => EntityModule),
    forwardRef(() => AuthModule),
    HookModule
  ],
  providers: [
    ManifestService,
    YamlService,
    SchemaService,
    EntityManifestService,
    RelationshipManifestService
  ],
  controllers: [ManifestController],
  exports: [ManifestService, EntityManifestService, RelationshipManifestService]
})
export class ManifestModule {}
