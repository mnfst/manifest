import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodeController } from './node.controller';
import { NodeTypesController } from './node-types.controller';
import { NodeService } from './node.service';
import { FlowEntity } from '../flow/flow.entity';

/**
 * Module for Node and Connection management.
 * Provides REST endpoints for CRUD operations on nodes/connections within flows.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FlowEntity])],
  controllers: [NodeController, NodeTypesController],
  providers: [NodeService],
  exports: [NodeService],
})
export class NodeModule {}
