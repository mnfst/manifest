import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnValueEntity } from './return-value.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ReturnValueService } from './return-value.service';
import { ReturnValueController } from './return-value.controller';

/**
 * ReturnValue module for managing text content items returned from MCP tools
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReturnValueEntity, FlowEntity])],
  controllers: [ReturnValueController],
  providers: [ReturnValueService],
  exports: [ReturnValueService],
})
export class ReturnValueModule {}
