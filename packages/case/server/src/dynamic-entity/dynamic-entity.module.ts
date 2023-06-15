import { Module } from '@nestjs/common'

import { DynamicEntityController } from './dynamic-entity.controller'
import { DynamicEntitySeeder } from './dynamic-entity.seeder'
import { DynamicEntityService } from './dynamic-entity.service'

@Module({
  controllers: [DynamicEntityController],
  providers: [DynamicEntityService, DynamicEntitySeeder]
})
export class DynamicEntityModule {}
