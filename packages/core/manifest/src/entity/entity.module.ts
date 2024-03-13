import { Module } from '@nestjs/common'
import { EntityService } from './services/entity-loader/entity-loader.service'

@Module({
  providers: [EntityService],
  exports: [EntityService]
})
export class EntityModule {}
