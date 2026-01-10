import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { UserAppRoleEntity } from '../auth/user-app-role.entity';

/**
 * Module for database seeding on application startup.
 * Creates default fixtures (Test App, Test Flow) for PR testing.
 * Also creates admin user and assigns ownership.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AppEntity, FlowEntity, UserAppRoleEntity])],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
