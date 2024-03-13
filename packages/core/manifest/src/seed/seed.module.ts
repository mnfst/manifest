import { Module } from '@nestjs/common'
import { EntityModule } from '../entity/entity.module'
import { SeederService } from './seeder.service'

@Module({
  imports: [EntityModule],
  providers: [SeederService]
})
export class SeedModule {}
