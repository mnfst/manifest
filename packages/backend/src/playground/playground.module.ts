import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import { PlaygroundRun } from '../entities/playground-run.entity';
import { PlaygroundColumn } from '../entities/playground-column.entity';
import { CommonModule } from '../common/common.module';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { RoutingCoreModule } from '../routing/routing-core/routing-core.module';
import { ProxyModule } from '../routing/proxy/proxy.module';
import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';
import { PlaygroundHistoryService } from './playground-history.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentMessage, PlaygroundRun, PlaygroundColumn]),
    CommonModule,
    ModelPricesModule,
    RoutingCoreModule,
    ProxyModule,
  ],
  controllers: [PlaygroundController],
  providers: [PlaygroundService, PlaygroundHistoryService],
})
export class PlaygroundModule {}
