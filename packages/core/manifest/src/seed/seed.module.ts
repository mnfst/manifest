import { Module } from '@nestjs/common'
import { EntityModule } from '../entity/entity.module'
import { ManifestModule } from '../manifest/manifest.module'
import { SeederService } from './seeder.service'

@Module({
  imports: [EntityModule, ManifestModule],
  providers: [SeederService]
})
export class SeedModule {}
