import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewEntity } from './view.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ViewService } from './view.service';
import { ViewController } from './view.controller';
import { AgentModule } from '../agent/agent.module';
import { MockDataModule } from '../mock-data/mock-data.module';

/**
 * View module for managing display units within flows
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ViewEntity, FlowEntity]),
    forwardRef(() => AgentModule),
    forwardRef(() => MockDataModule),
  ],
  controllers: [ViewController],
  providers: [ViewService],
  exports: [ViewService],
})
export class ViewModule {}
