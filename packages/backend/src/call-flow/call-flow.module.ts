import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallFlowEntity } from './call-flow.entity';
import { FlowEntity } from '../flow/flow.entity';
import { CallFlowService } from './call-flow.service';
import { CallFlowController } from './call-flow.controller';

/**
 * CallFlow module for managing call flow end actions
 */
@Module({
  imports: [TypeOrmModule.forFeature([CallFlowEntity, FlowEntity])],
  controllers: [CallFlowController],
  providers: [CallFlowService],
  exports: [CallFlowService],
})
export class CallFlowModule {}
