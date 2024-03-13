import { Module } from '@nestjs/common'
import { EntityModule } from '../entity/entity.module'
import { Seeder } from './seeder'

@Module({
  imports: [EntityModule],
  providers: [Seeder]
})
export class SeedModule {}
