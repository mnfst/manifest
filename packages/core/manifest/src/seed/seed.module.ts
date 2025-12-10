import { Module } from '@nestjs/common'
import { EntityModule } from '../entity/entity.module'
import { ManifestModule } from '../manifest/manifest.module'
import { SeederService } from './services/seeder.service'
import { StorageModule } from '../storage/storage.module'
import { SeederController } from './controllers/seeder/seeder.controller'

@Module({
  imports: [EntityModule, ManifestModule, StorageModule],
  providers: [SeederService],
  controllers: [SeederController]
})
export class SeedModule {}
