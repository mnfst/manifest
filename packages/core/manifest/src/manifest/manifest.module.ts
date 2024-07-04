import { Module, forwardRef } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { EntityModule } from '../entity/entity.module'
import { ManifestController } from './controllers/manifest.controller'
import { ManifestService } from './services/manifest.service'
import { SchemaService } from './services/schema.service'
import { YamlService } from './services/yaml.service'

/**
 *
 * The ManifestModule is a global module that provides services for working with the manifest file(s).
 * The module exports the ManifestService, which is used to load the manifest file(s).
 *
 */

@Module({
  imports: [forwardRef(() => EntityModule)],
  providers: [ManifestService, YamlService, SchemaService, AuthService],
  controllers: [ManifestController],
  exports: [ManifestService]
})
export class ManifestModule {}
