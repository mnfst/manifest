import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityEvent } from '../entities/security-event.entity';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityEvent])],
  controllers: [SecurityController],
  providers: [SecurityService],
})
export class SecurityModule {}
