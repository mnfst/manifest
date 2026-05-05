import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderTier } from '../../entities/header-tier.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { CommonModule } from '../../common/common.module';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { RoutingCoreModule } from '../routing-core/routing-core.module';
import { HeaderTierService } from './header-tier.service';
import { HeaderTierController } from './header-tier.controller';
import { SeenHeadersService } from './seen-headers.service';
import { SeenHeadersController } from './seen-headers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([HeaderTier, AgentMessage]),
    CommonModule,
    ModelDiscoveryModule,
    RoutingCoreModule,
  ],
  providers: [HeaderTierService, SeenHeadersService],
  controllers: [HeaderTierController, SeenHeadersController],
  exports: [HeaderTierService],
})
export class HeaderTiersModule {}
