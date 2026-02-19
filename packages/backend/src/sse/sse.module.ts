import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';

@Module({
  controllers: [SseController],
})
export class SseModule {}
