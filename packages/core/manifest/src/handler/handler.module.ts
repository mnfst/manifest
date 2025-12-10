import { Module } from '@nestjs/common'
import { HandlerService } from './handler.service'
import { SdkModule } from '../sdk/sdk.module'

@Module({
  imports: [SdkModule],
  providers: [HandlerService],
  exports: [HandlerService, SdkModule]
})
export class HandlerModule {}
