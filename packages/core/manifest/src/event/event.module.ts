import { Module } from '@nestjs/common'
import { EventService } from './event.service'

@Module({
  providers: [EventService],
  exports: [EventService]
})
export class EventModule {}
