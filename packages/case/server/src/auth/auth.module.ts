import { Module } from '@nestjs/common'

import { EntityMetaService } from '../crud/services/entity-meta.service'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  controllers: [AuthController],
  providers: [AuthService, EntityMetaService],
  exports: [AuthService]
})
export class AuthModule {}
