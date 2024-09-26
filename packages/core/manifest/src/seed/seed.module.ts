import { Module } from '@nestjs/common'
import { EntityModule } from '../entity/entity.module'
import { ManifestModule } from '../manifest/manifest.module'
import { SeederService } from './seeder.service'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [EntityModule, ManifestModule, StorageModule],
  providers: [SeederService]
})
export class SeedModule {}
