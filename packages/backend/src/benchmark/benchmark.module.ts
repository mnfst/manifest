import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import { BenchmarkRun } from '../entities/benchmark-run.entity';
import { BenchmarkColumn } from '../entities/benchmark-column.entity';
import { CommonModule } from '../common/common.module';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { RoutingCoreModule } from '../routing/routing-core/routing-core.module';
import { ProxyModule } from '../routing/proxy/proxy.module';
import { BenchmarkController } from './benchmark.controller';
import { BenchmarkService } from './benchmark.service';
import { BenchmarkHistoryService } from './benchmark-history.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentMessage, BenchmarkRun, BenchmarkColumn]),
    CommonModule,
    ModelPricesModule,
    RoutingCoreModule,
    ProxyModule,
  ],
  controllers: [BenchmarkController],
  providers: [BenchmarkService, BenchmarkHistoryService],
})
export class BenchmarkModule {}
