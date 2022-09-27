import { Module } from '@nestjs/common'
import { PaginationService } from '../../services/pagination.service'

import { RoleController } from './role.controller'
import { RoleService } from './role.service'

@Module({
  controllers: [RoleController],
  providers: [RoleService, PaginationService]
})
export class RoleModule {}
