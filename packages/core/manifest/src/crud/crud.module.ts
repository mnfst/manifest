import { Module } from '@nestjs/common'

import { CrudController } from './controllers/crud.controller'

import { EntityModule } from '../entity/entity.module'
import { ManifestModule } from '../manifest/manifest.module'
import { CrudService } from './services/crud.service'
import { PaginationService } from './services/pagination.service'

@Module({
  imports: [EntityModule, ManifestModule],
  controllers: [CrudController],
  providers: [CrudService, PaginationService]
})
export class CrudModule {}
