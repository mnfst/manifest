import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowExecutionEntity } from './flow-execution.entity';
import { FlowExecutionService } from './flow-execution.service';
import { FlowExecutionController } from './flow-execution.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FlowExecutionEntity])],
  providers: [FlowExecutionService],
  controllers: [FlowExecutionController],
  exports: [FlowExecutionService],
})
export class FlowExecutionModule {}
