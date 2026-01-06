import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowEntity } from './flow.entity';
import { FlowService } from './flow.service';
import { FlowController } from './flow.controller';
import { AppEntity } from '../app/app.entity';

/**
 * Flow module for managing MCP tools
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FlowEntity, AppEntity]),
  ],
  controllers: [FlowController],
  providers: [FlowService],
  exports: [FlowService],
})
export class FlowModule {}
