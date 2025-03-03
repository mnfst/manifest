import { Module } from '@nestjs/common'
import { HookService } from './hook.service'
import { EventModule } from '../event/event.module'

@Module({
  imports: [EventModule],
  providers: [HookService],
  exports: [HookService, EventModule]
})
export class HookModule {}
