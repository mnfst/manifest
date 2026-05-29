import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../entities/agent.entity';
import { RoutingCoreModule } from './routing-core/routing-core.module';
import { HeaderTiersModule } from './header-tiers/header-tiers.module';
import { RoutingAliasService } from './routing-alias.service';

@Module({
  imports: [TypeOrmModule.forFeature([Agent]), RoutingCoreModule, HeaderTiersModule],
  providers: [RoutingAliasService],
  exports: [RoutingAliasService],
})
export class RoutingAliasModule {}
