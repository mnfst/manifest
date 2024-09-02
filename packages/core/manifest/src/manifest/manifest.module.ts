import { Module, forwardRef } from '@nestjs/common'
import { EntityModule } from '../entity/entity.module'
import { ManifestController } from './controllers/manifest.controller'
import { ManifestService } from './services/manifest.service'
import { SchemaService } from './services/schema.service'
import { YamlService } from './services/yaml.service'
import { AuthModule } from '../auth/auth.module'

/**
 *
 * The ManifestModule is a global module that provides services for working with the manifest file(s).
 * The module exports the ManifestService, which is used to load the manifest file(s).
 *
 */

@Module({
  imports: [forwardRef(() => EntityModule), forwardRef(() => AuthModule)],
  providers: [ManifestService, YamlService, SchemaService],
  controllers: [ManifestController],
  exports: [ManifestService]
})
export class ManifestModule {}
