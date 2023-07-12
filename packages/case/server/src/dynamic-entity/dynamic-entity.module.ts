import { Module } from '@nestjs/common'

import { AuthService } from '../auth/auth.service'
import { DynamicEntityController } from './dynamic-entity.controller'
import { DynamicEntitySeeder } from './dynamic-entity.seeder'
import { DynamicEntityService } from './dynamic-entity.service'

@Module({
  controllers: [DynamicEntityController],
  providers: [DynamicEntityService, DynamicEntitySeeder, AuthService]
})
export class DynamicEntityModule {}
