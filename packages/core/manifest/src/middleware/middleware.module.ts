import { Module, forwardRef } from '@nestjs/common'
import { EventModule } from '../event/event.module'
import { HandlerModule } from '../handler/handler.module'

@Module({
  imports: [EventModule, forwardRef(() => HandlerModule)],
  exports: [forwardRef(() => HandlerModule)]
})
export class MiddlewareModule {}
