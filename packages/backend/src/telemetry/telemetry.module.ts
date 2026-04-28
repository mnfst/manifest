import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../entities/agent.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { InstallMetadata } from '../entities/install-metadata.entity';
import { InstallIdService } from './install-id.service';
import { PayloadBuilderService } from './payload-builder.service';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [TypeOrmModule.forFeature([InstallMetadata, AgentMessage, Agent])],
  providers: [InstallIdService, PayloadBuilderService, TelemetryService],
})
export class TelemetryModule {}
