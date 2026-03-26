import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentMessage } from '../entities/agent-message.entity';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentMessage]), ModelPricesModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
})
export class TelemetryModule {}
