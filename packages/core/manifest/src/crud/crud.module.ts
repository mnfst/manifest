import { Module } from '@nestjs/common'

import { EntityModule } from '../entity/entity.module'
import { ManifestModule } from '../manifest/manifest.module'
import { CrudService } from './services/crud.service'
import { PaginationService } from './services/pagination.service'
import { ValidationModule } from '../validation/validation.module'
import { AuthService } from '../auth/auth.service'
import { DatabaseService } from './services/database.service'
import { DatabaseController } from './controllers/database.controller'
import { CollectionController } from './controllers/collection.controller'
import { SingleController } from './controllers/single.controller'
import { HookModule } from '../hook/hook.module'

@Module({
  imports: [EntityModule, ManifestModule, ValidationModule, HookModule],
  controllers: [CollectionController, DatabaseController, SingleController],
  providers: [CrudService, PaginationService, AuthService, DatabaseService],
  exports: [DatabaseService]
})
export class CrudModule {}
