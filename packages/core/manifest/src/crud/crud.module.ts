import { Module, forwardRef } from '@nestjs/common'

import { EntityModule } from '../entity/entity.module'
import { ManifestModule } from '../manifest/manifest.module'
import { CrudService } from './services/crud.service'
import { PaginationService } from './services/pagination.service'
import { ValidationModule } from '../validation/validation.module'
import { DatabaseService } from './services/database.service'
import { DatabaseController } from './controllers/database.controller'
import { CollectionController } from './controllers/collection.controller'
import { SingleController } from './controllers/single.controller'
import { HookModule } from '../hook/hook.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    forwardRef(() => EntityModule),
    forwardRef(() => ManifestModule),
    forwardRef(() => AuthModule),
    ValidationModule,
    HookModule
  ],
  controllers: [CollectionController, DatabaseController, SingleController],
  providers: [CrudService, PaginationService, DatabaseService],
  exports: [DatabaseService, CrudService]
})
export class CrudModule {}
