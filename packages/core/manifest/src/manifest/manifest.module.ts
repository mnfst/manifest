import { Global, Module } from '@nestjs/common'
import { ManifestService } from './services/manifest/manifest.service'
import { SchemaService } from './services/schema/schema.service'
import { YamlService } from './services/yaml/yaml.service'

/**
 *
 * The ManifestModule is a global module that provides services for working with the manifest file(s).
 * The module exports the ManifestService, which is used to load the manifest file(s).
 *
 */
@Global()
@Module({
  providers: [ManifestService, YamlService, SchemaService],
  exports: [ManifestService]
})
export class ManifestModule {}
