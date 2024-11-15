import { Module, forwardRef } from '@nestjs/common'

import { EntityModule } from '../entity/entity.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { ManifestModule } from '../manifest/manifest.module'
import { DatabaseService } from '../crud/services/database.service'

@Module({
  imports: [EntityModule, forwardRef(() => ManifestModule)],
  controllers: [AuthController],
  providers: [AuthService, DatabaseService],
  exports: [AuthService]
})
export class AuthModule {}
