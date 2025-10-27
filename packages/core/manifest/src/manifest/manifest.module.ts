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
import { PolicyModule } from '../policy/policy.module'
import { EndpointModule } from '../endpoint/endpoint.module'
import { PropertyManifestService } from './services/property-manifest.service'
import { LockFileService } from './services/lock-file.service'
import { ManifestFileController } from './controllers/manifest-file.controller'
import { StorageModule } from '../storage/storage.module'
import { ManifestWriterService } from './services/manifest-writer.service'
import { ManifestWriterController } from './controllers/manifest-writer.controller'

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
    forwardRef(() => EndpointModule),
    HookModule,
    PolicyModule,
    StorageModule
  ],
  providers: [
    ManifestService,
    YamlService,
    SchemaService,
    EntityManifestService,
    PropertyManifestService,
    RelationshipManifestService,
    LockFileService,
    ManifestWriterService
  ],
  controllers: [
    ManifestController,
    ManifestFileController,
    ManifestWriterController
  ],
  exports: [
    ManifestService,
    EntityManifestService,
    RelationshipManifestService,
    YamlService,
    SchemaService
  ]
})
export class ManifestModule {}
