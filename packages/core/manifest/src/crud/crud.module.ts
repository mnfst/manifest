import { Module } from '@nestjs/common'

import { CrudController } from './controllers/crud.controller'

import { EntityModule } from '../entity/entity.module'
import { ManifestModule } from '../manifest/manifest.module'
import { CrudService } from './services/crud.service'
import { PaginationService } from './services/pagination.service'
import { AuthService } from '../auth/auth.service'

@Module({
  imports: [EntityModule, ManifestModule],
  controllers: [CrudController],
  providers: [CrudService, PaginationService, AuthService]
})
export class CrudModule {}
