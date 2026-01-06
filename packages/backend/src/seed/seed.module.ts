import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';

/**
 * Module for database seeding on application startup.
 * Creates default fixtures (Test App, Test Flow) for PR testing.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AppEntity, FlowEntity])],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
