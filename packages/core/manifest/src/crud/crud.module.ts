import { Module } from '@nestjs/common'

import { CrudController } from './controllers/crud.controller'

import { EntityModule } from '../entity/entity.module'
import { ManifestModule } from '../manifest/manifest.module'
import { CrudService } from './services/crud.service'

@Module({
  imports: [EntityModule, ManifestModule],
  controllers: [CrudController],
  providers: [CrudService]
})
export class CrudModule {}
