import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectorEntity } from '../entities/connector.entity';
import { ConnectorService } from './connector.service';
import { ConnectorController } from './connector.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConnectorEntity])],
  controllers: [ConnectorController],
  providers: [ConnectorService],
  exports: [ConnectorService],
})
export class ConnectorModule {}
