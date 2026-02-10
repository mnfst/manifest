import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { FlowEntity } from '../flow/flow.entity';
import { AppEntity } from '../app/app.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlowExecutionEntity, FlowEntity, AppEntity]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
