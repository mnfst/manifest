import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodeController } from './node.controller';
import { NodeTypesController } from './node-types.controller';
import { NodeService } from './node.service';
import { SchemaService } from './schema/schema.service';
import { FlowEntity } from '../flow/flow.entity';

/**
 * Module for Node and Connection management.
 * Provides REST endpoints for CRUD operations on nodes/connections within flows.
 * Includes schema validation services for I/O compatibility checking.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FlowEntity])],
  controllers: [NodeController, NodeTypesController],
  providers: [NodeService, SchemaService],
  exports: [NodeService, SchemaService],
})
export class NodeModule {}
