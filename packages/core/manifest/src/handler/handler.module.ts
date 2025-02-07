import { Module, forwardRef } from '@nestjs/common'
import { HandlerService } from './handler.service'
import { SdkModule } from '../sdk/sdk.module'

@Module({
  imports: [forwardRef(() => SdkModule)],
  providers: [HandlerService],
  exports: [HandlerService]
})
export class HandlerModule {}
