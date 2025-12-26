import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewEntity } from './view.entity';
import { ViewService } from './view.service';
import { ViewController } from './view.controller';
import { AgentModule } from '../agent/agent.module';

/**
 * View module for managing display units within flows
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ViewEntity]),
    forwardRef(() => AgentModule),
  ],
  controllers: [ViewController],
  providers: [ViewService],
  exports: [ViewService],
})
export class ViewModule {}
