import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionConnectionEntity } from './action-connection.entity';
import { ViewEntity } from '../view/view.entity';
import { ReturnValueEntity } from '../return-value/return-value.entity';
import { CallFlowEntity } from '../call-flow/call-flow.entity';
import { ActionConnectionService } from './action-connection.service';
import { ActionConnectionController } from './action-connection.controller';

/**
 * ActionConnection module for managing action connections between view actions and targets
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActionConnectionEntity,
      ViewEntity,
      ReturnValueEntity,
      CallFlowEntity,
    ]),
  ],
  controllers: [ActionConnectionController],
  providers: [ActionConnectionService],
  exports: [ActionConnectionService],
})
export class ActionConnectionModule {}
