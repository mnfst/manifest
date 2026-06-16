import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstallMetadata } from '../entities/install-metadata.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { RetentionService } from './retention.service';
import { RetentionController } from './retention.controller';
import { RetentionCronService } from './retention-cron.service';

@Module({
	imports: [TypeOrmModule.forFeature([InstallMetadata, AgentMessage])],
	controllers: [RetentionController],
	providers: [RetentionService, RetentionCronService],
	exports: [RetentionService],
})
export class RetentionModule {}
