import { Module } from '@nestjs/common'
import { Seeder } from './seeder'

@Module({
  providers: [Seeder]
})
export class SeedModule {}
