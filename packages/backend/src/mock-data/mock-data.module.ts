import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MockDataEntity } from './mock-data.entity';
import { MockDataService } from './mock-data.service';
import { MockDataController } from './mock-data.controller';
import { AgentModule } from '../agent/agent.module';
import { ViewModule } from '../view/view.module';

/**
 * MockData module for managing sample data entities
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MockDataEntity]),
    forwardRef(() => AgentModule),
    forwardRef(() => ViewModule),
  ],
  controllers: [MockDataController],
  providers: [MockDataService],
  exports: [MockDataService],
})
export class MockDataModule {}
