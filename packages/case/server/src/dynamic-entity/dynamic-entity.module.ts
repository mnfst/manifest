import { Module } from '@nestjs/common'

import { DynamicEntityController } from './dynamic-entity.controller'
import { DynamicEntityService } from './dynamic-entity.service'

@Module({
  controllers: [DynamicEntityController],
  providers: [DynamicEntityService]
})
export class DynamicEntityModule {}
